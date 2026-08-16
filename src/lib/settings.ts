import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getSettings = cache(async () => {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 1 } });
});
