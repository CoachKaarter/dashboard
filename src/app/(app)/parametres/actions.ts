"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";

const FIELDS = [
  "seuilPresence", "fenetreSeances", "absRecentes", "seuilANJ", "delaiEval",
  "ecartTdj", "delaiConvoc", "delaiMaillots", "periodeTdj", "horizonMatch",
  "minMinutes", "delaiRdv",
] as const;

export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const data: Record<string, number> = {};
  for (const f of FIELDS) {
    const raw = formData.get(f);
    if (raw !== null && raw !== "") data[f] = Number(raw);
  }
  await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/parametres");
  revalidatePath("/");
  revalidatePath("/alertes");
}

export async function createSeason(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  if (!label || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;

  await prisma.season.create({ data: { label, startDate, endDate } });
  revalidatePath("/parametres");
}

export async function setCurrentSeason(seasonId: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.season.updateMany({ data: { isCurrent: false } }),
    prisma.season.update({ where: { id: seasonId }, data: { isCurrent: true } }),
  ]);
  revalidatePath("/parametres");
}
