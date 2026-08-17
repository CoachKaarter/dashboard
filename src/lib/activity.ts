import { prisma } from "@/lib/prisma";

/**
 * Records one line in the staff activity journal (/journal, admin-only).
 * Never throws — a logging failure must not break the action that
 * triggered it, so errors are swallowed after a console warning.
 */
export async function logActivity(params: {
  actorId?: string | null;
  summary: string;
  entityType?: string;
  entityId?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: params.actorId ?? null,
        summary: params.summary,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    });
  } catch (e) {
    console.warn("logActivity failed:", e);
  }
}
