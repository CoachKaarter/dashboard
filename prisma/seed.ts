/**
 * CLI entry point for seeding — thin wrapper around the shared seed logic
 * in src/lib/seed-data.ts (also used by the one-time /api/seed route).
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDatabase, DEMO_PASSWORD } from "../src/lib/seed-data";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

seedDatabase(prisma)
  .then((result) => {
    console.log(`Seeded ${result.players} players across ${result.teams} teams.`);
    console.log(`Demo accounts: ${result.staff.join(", ")} — password "${DEMO_PASSWORD}"`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
