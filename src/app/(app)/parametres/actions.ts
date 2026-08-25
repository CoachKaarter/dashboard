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

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
// SVG deliberately excluded — it can embed script and isn't worth the extra
// sanitization work for a first version (club logos are fine as raster).
const ALLOWED_LOGO_TYPES: Record<string, (buf: Uint8Array) => boolean> = {
  "image/png": (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

export async function updateClub(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();
  const primaryColor = String(formData.get("primaryColor") ?? "");
  const secondaryColor = String(formData.get("secondaryColor") ?? "");
  const accentColor = String(formData.get("accentColor") ?? "");

  const data: {
    name?: string;
    shortName?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    logoData?: Uint8Array<ArrayBuffer> | null;
    logoMimeType?: string | null;
  } = {};
  if (name) data.name = name;
  data.shortName = shortName || null;
  if (HEX_COLOR.test(primaryColor)) data.primaryColor = primaryColor;
  if (HEX_COLOR.test(secondaryColor)) data.secondaryColor = secondaryColor;
  if (HEX_COLOR.test(accentColor)) data.accentColor = accentColor;

  if (formData.get("removeLogo") === "1") {
    data.logoData = null;
    data.logoMimeType = null;
  } else {
    const file = formData.get("logo");
    // Never trust the client's declared MIME type alone — the buffer's own
    // magic bytes must match it, or the upload is refused outright.
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_LOGO_BYTES) throw new Error("Le logo dépasse la taille maximale autorisée (2 Mo).");
      const check = ALLOWED_LOGO_TYPES[file.type];
      if (!check) throw new Error("Format de logo non pris en charge (PNG, JPEG ou WebP uniquement).");
      const buf = new Uint8Array(await file.arrayBuffer());
      if (!check(buf)) throw new Error("Le fichier envoyé ne correspond pas à une image valide.");
      data.logoData = buf;
      data.logoMimeType = file.type;
    }
  }

  await prisma.club.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/parametres");
  revalidatePath("/");
  revalidatePath("/coach");
  revalidatePath("/parent");
}

// Champ laissé vide = retour au texte par défaut codé en dur
// (src/lib/message-templates.ts) — pas de valeur "vide" stockée en base.
export async function updateMessageTemplates(formData: FormData) {
  await requireAdmin();
  const availabilityMessageTemplate = String(formData.get("availabilityMessageTemplate") ?? "").trim() || null;
  const convocationMessageTemplate = String(formData.get("convocationMessageTemplate") ?? "").trim() || null;

  await prisma.club.upsert({
    where: { id: 1 },
    update: { availabilityMessageTemplate, convocationMessageTemplate },
    create: { id: 1, availabilityMessageTemplate, convocationMessageTemplate },
  });
  revalidatePath("/parametres");
  revalidatePath("/disponibilites");
  revalidatePath("/week-end");
}
