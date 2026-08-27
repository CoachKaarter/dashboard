"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireResponsableOrAdmin } from "@/lib/authz";
import { COMPETITION_TYPES } from "@/lib/match-validation";
import { TRANSPORT_MODES } from "@/lib/equipment";

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

// Lieux réutilisables (§5-6 du système d'héritage des infos parents) —
// simple registre servant à préremplir location/venueAddress d'un match,
// jamais lu ailleurs en direct : voir src/lib/match-parent-info.ts.
export async function createVenue(formData: FormData) {
  await requireResponsableOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.venue.create({
    data: {
      name,
      address: String(formData.get("address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      meetingPoint: String(formData.get("meetingPoint") ?? "").trim() || null,
      parkingInfo: String(formData.get("parkingInfo") ?? "").trim() || null,
      accessInfo: String(formData.get("accessInfo") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath("/parametres");
}

export async function updateVenue(venueId: string, formData: FormData) {
  await requireResponsableOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.venue.update({
    where: { id: venueId },
    data: {
      name,
      address: String(formData.get("address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      meetingPoint: String(formData.get("meetingPoint") ?? "").trim() || null,
      parkingInfo: String(formData.get("parkingInfo") ?? "").trim() || null,
      accessInfo: String(formData.get("accessInfo") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath("/parametres");
}

export async function deleteVenue(venueId: string) {
  await requireResponsableOrAdmin();
  await prisma.venue.delete({ where: { id: venueId } });
  revalidatePath("/parametres");
}

// Modèles de match (§7-8) — combinaison compétition + domicile/extérieur
// sélectionnée automatiquement à la création d'un match (voir
// selectMatchTemplate dans src/lib/match-parent-info.ts), toujours
// modifiable ensuite sur le match lui-même.
function matchTemplateData(formData: FormData) {
  const competitionRaw = String(formData.get("competition") ?? "");
  const competition = COMPETITION_TYPES.includes(competitionRaw as (typeof COMPETITION_TYPES)[number]) ? competitionRaw : null;
  const isHomeRaw = String(formData.get("isHome") ?? "");
  const isHome = isHomeRaw === "true" ? true : isHomeRaw === "false" ? false : null;
  const intOrNull = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const strOrNull = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const transportRaw = String(formData.get("transportMode") ?? "");
  const transportMode = TRANSPORT_MODES.includes(transportRaw as (typeof TRANSPORT_MODES)[number]) ? transportRaw : null;
  return {
    competition,
    isHome,
    meetTimeDeltaMinutes: intOrNull("meetTimeDeltaMinutes"),
    durationMinutes: intOrNull("durationMinutes"),
    returnDelayMinutes: intOrNull("returnDelayMinutes"),
    transportMode,
    dressCode: strOrNull("dressCode"),
    personalGear: strOrNull("personalGear"),
    mealInfo: strOrNull("mealInfo"),
    parentInstructions: strOrNull("parentInstructions"),
  };
}

export async function createMatchTemplate(formData: FormData) {
  await requireResponsableOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.matchTemplate.create({ data: { name, ...matchTemplateData(formData) } });
  revalidatePath("/parametres");
}

export async function updateMatchTemplate(templateId: string, formData: FormData) {
  await requireResponsableOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.matchTemplate.update({ where: { id: templateId }, data: { name, ...matchTemplateData(formData) } });
  revalidatePath("/parametres");
}

export async function deleteMatchTemplate(templateId: string) {
  await requireResponsableOrAdmin();
  await prisma.matchTemplate.delete({ where: { id: templateId } });
  revalidatePath("/parametres");
}

// Champ laissé vide = retour au texte par défaut codé en dur
// (src/lib/message-templates.ts) — pas de valeur "vide" stockée en base.
export async function updateMessageTemplates(formData: FormData) {
  await requireAdmin();
  const availabilityMessageTemplate = String(formData.get("availabilityMessageTemplate") ?? "").trim() || null;
  const convocationMessageTemplate = String(formData.get("convocationMessageTemplate") ?? "").trim() || null;
  const includeWeekendResultsInAvailabilityMessage = formData.get("includeWeekendResultsInAvailabilityMessage") === "on";

  await prisma.club.upsert({
    where: { id: 1 },
    update: { availabilityMessageTemplate, convocationMessageTemplate, includeWeekendResultsInAvailabilityMessage },
    create: { id: 1, availabilityMessageTemplate, convocationMessageTemplate, includeWeekendResultsInAvailabilityMessage },
  });
  revalidatePath("/parametres");
  revalidatePath("/disponibilites");
  revalidatePath("/week-end");
}
