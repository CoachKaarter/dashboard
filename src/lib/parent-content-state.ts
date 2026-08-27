/**
 * Accueil Parent v2 — persistance NEW/SEEN/COMPLETED (spec §8), une seule
 * table générique ParentContentState (voir prisma/schema.prisma) plutôt
 * qu'un champ seenAt par modèle. Deux usages distincts de `lastSnapshot`,
 * volontairement séparés :
 *
 *  - `seenAt` (posé par recordSeen/recordSeenSnapshot) porte uniquement la
 *    transition NEW → SEEN (l'animation ne rejoue pas). Rien à voir avec
 *    "la réponse est-elle encore valide".
 *  - `lastSnapshot`, quand il est mis à jour par recordResponseSnapshot
 *    (uniquement au moment où le parent répond réellement — confirme sa
 *    présence, par exemple), ancre "à quelle version du contenu cette
 *    réponse s'applique". Un simple `recordSeen` (consultation sans
 *    réponse) NE TOUCHE PAS ce snapshot : voir un match modifié une
 *    deuxième fois avant confirmation ne doit pas faire disparaître le
 *    signal "modifié" juste parce que le parent a ouvert l'écran. Pour les
 *    contenus sans action de réponse (séance, annonce, objectif, retour
 *    coach — juste "vu" fait foi), recordSeenSnapshot met à jour seenAt ET
 *    lastSnapshot ensemble : les revoir une fois suffit à "acquitter" le
 *    changement affiché.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type EntityRef = { entityType: string; entityId: string };

export type ContentState = { seenAt: Date | null; completedAt: Date | null; lastSnapshot: unknown };

function key(ref: EntityRef) {
  return `${ref.entityType}:${ref.entityId}`;
}

/** Un seul aller-retour DB pour tous les refs d'un même parent (pas de N+1 par carte). */
export async function loadContentStates(parentAccountId: string, refs: EntityRef[]): Promise<Map<string, ContentState>> {
  if (refs.length === 0) return new Map();
  const rows = await prisma.parentContentState.findMany({
    where: { parentAccountId, OR: refs.map((r) => ({ entityType: r.entityType, entityId: r.entityId })) },
  });
  return new Map(rows.map((r) => [key(r), { seenAt: r.seenAt, completedAt: r.completedAt, lastSnapshot: r.lastSnapshot }]));
}

export function getState(states: Map<string, ContentState>, ref: EntityRef): ContentState | null {
  return states.get(key(ref)) ?? null;
}

async function upsert(parentAccountId: string, ref: EntityRef, data: { seenAt?: Date; completedAt?: Date; lastSnapshot?: Prisma.InputJsonValue }) {
  await prisma.parentContentState.upsert({
    where: { parentAccountId_entityType_entityId: { parentAccountId, entityType: ref.entityType, entityId: ref.entityId } },
    update: data,
    create: { parentAccountId, entityType: ref.entityType, entityId: ref.entityId, ...data },
  });
}

/** Consultation simple — éteint l'animation NEW, ne touche jamais lastSnapshot. */
export function recordSeen(parentAccountId: string, ref: EntityRef) {
  return upsert(parentAccountId, ref, { seenAt: new Date() });
}

/** Consultation qui vaut acquittement (séance, annonce, objectif, retour coach, retrait de convocation). */
export function recordSeenSnapshot(parentAccountId: string, ref: EntityRef, snapshot: Prisma.InputJsonValue) {
  return upsert(parentAccountId, ref, { seenAt: new Date(), lastSnapshot: snapshot });
}

/** Réponse effective du parent (confirme/décline sa présence, renseigne une disponibilité...). */
export function recordResponseSnapshot(parentAccountId: string, ref: EntityRef, snapshot: Prisma.InputJsonValue) {
  return upsert(parentAccountId, ref, { seenAt: new Date(), completedAt: new Date(), lastSnapshot: snapshot });
}

export type FieldChange = { field: string; from: string; to: string };

/**
 * Pur — compare l'instantané connu (lastSnapshot, potentiellement null si
 * jamais répondu/vu) aux valeurs actuelles. null en entrée = rien à
 * comparer (contenu tout juste apparu, c'est un NEW, pas un MODIFIED) :
 * voir buildConvocationCard/buildSessionCard qui traitent isNew et changes
 * comme deux signaux distincts et non exclusifs.
 */
export function diffSnapshot(prevSnapshot: unknown, next: Record<string, string | null>): FieldChange[] {
  if (!prevSnapshot || typeof prevSnapshot !== "object") return [];
  const prev = prevSnapshot as Record<string, unknown>;
  const changes: FieldChange[] = [];
  for (const field of Object.keys(next)) {
    if (!(field in prev)) continue; // absent de l'instantané connu → rien à comparer, pas "changé"
    const prevVal = (prev[field] as string | null) ?? null;
    const nextVal = next[field];
    if (prevVal !== nextVal) changes.push({ field, from: prevVal ?? "—", to: nextVal ?? "—" });
  }
  return changes;
}

/**
 * Champs suivis pour détecter une modification de convocation (spec Cycle 3
 * ; étendu pour couvrir les infos pratiques issues de l'héritage
 * Team/MatchTemplate — un match republié avec un nouveau transport ou une
 * nouvelle adresse doit remonter comme "modifié" au même titre qu'un
 * changement d'horaire).
 */
export function convocationSnapshot(m: {
  date: Date;
  time: string | null;
  opponent: string | null;
  meetTime: string | null;
  meetLocation: string | null;
  location: string | null;
  estimatedEndTime?: string | null;
  estimatedReturnTime?: string | null;
  venueAddress?: string | null;
  transportMode?: string | null;
  dressCode?: string | null;
  personalGear?: string | null;
  mealInfo?: string | null;
  parentInstructions?: string | null;
}): Record<string, string | null> {
  return {
    date: m.date.toISOString().slice(0, 10),
    time: m.time,
    opponent: m.opponent,
    meetTime: m.meetTime,
    meetLocation: m.meetLocation,
    location: m.location,
    estimatedEndTime: m.estimatedEndTime ?? null,
    estimatedReturnTime: m.estimatedReturnTime ?? null,
    venueAddress: m.venueAddress ?? null,
    transportMode: m.transportMode ?? null,
    dressCode: m.dressCode ?? null,
    personalGear: m.personalGear ?? null,
    mealInfo: m.mealInfo ?? null,
    parentInstructions: m.parentInstructions ?? null,
  };
}

/** Champs suivis pour détecter une modification de séance (spec Cycle 9). */
export function sessionSnapshot(s: { startTime: string; endTime: string; location: string }): Record<string, string | null> {
  return { startTime: s.startTime, endTime: s.endTime, location: s.location };
}

// Politique de reconfirmation (spec §17) — voir aussi le commentaire en tête
// de src/lib/parent-priority.ts. Un changement de date/horaire/adversaire
// invalide une réponse déjà donnée ; un simple ajustement de lieu/rendez-vous
// ne le fait pas.
const MAJOR_CONVOCATION_FIELDS = new Set(["date", "time", "opponent"]);

export function isMajorConvocationChange(changes: FieldChange[]): boolean {
  return changes.some((c) => MAJOR_CONVOCATION_FIELDS.has(c.field));
}
