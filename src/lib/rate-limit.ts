import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** Vercel (and most reverse proxies) set x-forwarded-for; falls back to a shared bucket rather than throwing when it's absent (local dev). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Postgres-backed rate limiting — an in-memory Map would NOT work correctly
// here: Vercel runs multiple serverless instances, each with its own
// memory, so a Map-based counter could be bypassed just by hitting a
// different instance. RateLimitHit already lives in the same Postgres
// database as everything else via Prisma, so it's correct by construction
// regardless of instance count, with no extra infra (Redis/Upstash) to add.
//
// Sliding window: count hits for `key` in the last `windowMs`; if under
// `max`, record a new hit and allow; otherwise block. Old hits for this key
// are opportunistically pruned on every check so the table doesn't grow
// unbounded — no cron job needed at this volume (a few hundred families).
export async function checkRateLimit(key: string, opts: { max: number; windowMs: number }): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Date.now() - opts.windowMs);

  const [count] = await prisma.$transaction([
    prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } }),
    prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } }),
  ]);

  if (count >= opts.max) return { allowed: false };

  await prisma.rateLimitHit.create({ data: { key } });
  return { allowed: true };
}
