/**
 * CLI entry point for the ANONYMIZED development seed — fully fictional
 * data, safe to run against any local/throwaway database. Never touches
 * src/lib/seed-data.ts (the real club roster). Run explicitly:
 *
 *   npx tsx prisma/seed-dev.ts
 *
 * `npx prisma db seed` / `npm run db:seed` still run prisma/seed.ts (the
 * real data) — this script is intentionally not wired into that default,
 * since real-data seeding is what production onboarding needs.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDevDatabase, DEV_DEMO_PASSWORD } from "../src/lib/seed-data-dev";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

seedDevDatabase(prisma)
  .then((result) => {
    console.log(`Seeded ${result.players} fictional players across ${result.teams} teams.`);
    console.log(`Dev accounts: ${result.staff.join(", ")} — password "${DEV_DEMO_PASSWORD}"`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
