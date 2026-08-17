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
