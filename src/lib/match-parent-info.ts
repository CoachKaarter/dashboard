// Héritage des "infos parents" d'un match — Match (override explicite) >
// MatchTemplate > Team > réglages généraux du club > vide. Pure et testée :
// toute la logique de résolution vit ici, jamais dupliquée dans les Server
// Actions ou les pages qui l'utilisent. Voir prisma/schema.prisma (Team,
// MatchTemplate, Match.parentInfoPublishedAt) pour le modèle de données.
//
// Principe central : sur Match, un champ "infos parents" (meetTime,
// transportMode, dressCode…) qui vaut `null` NE SIGNIFIE PLUS "rien à
// afficher" — il signifie "hérite du niveau au-dessus". Une valeur non
// nulle a toujours été, et reste, un override explicite pour CE match.
// Cela ne casse aucune donnée existante : tout Match déjà en base avec ces
// champs déjà renseignés continue de fonctionner à l'identique (ce sont
// déjà des overrides au sens de ce nouveau modèle).

export type ResolvedSource = "match" | "template" | "team" | "global" | "none";
export type Resolved<T> = { value: T; source: ResolvedSource };

/** Ajoute (ou retranche, delta négatif) des minutes à une heure "HH:MM", avec repli sur 24h. */
export function shiftTime(time: string, deltaMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + deltaMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function resolveMeetTime(input: {
  kickoffTime: string | null;
  override: string | null;
  templateDeltaMinutes: number | null;
  teamDeltaMinutes: number | null;
  globalDeltaMinutes: number; // Settings.delaiRdv — a toujours une valeur (colonne @default)
}): Resolved<string | null> {
  if (input.override) return { value: input.override, source: "match" };
  if (!input.kickoffTime) return { value: null, source: "none" };
  if (input.templateDeltaMinutes != null) return { value: shiftTime(input.kickoffTime, -input.templateDeltaMinutes), source: "template" };
  if (input.teamDeltaMinutes != null) return { value: shiftTime(input.kickoffTime, -input.teamDeltaMinutes), source: "team" };
  return { value: shiftTime(input.kickoffTime, -input.globalDeltaMinutes), source: "global" };
}

export function resolveEstimatedEnd(input: {
  kickoffTime: string | null;
  override: string | null;
  templateDurationMinutes: number | null;
  teamDurationMinutes: number | null;
}): Resolved<string | null> {
  if (input.override) return { value: input.override, source: "match" };
  if (!input.kickoffTime) return { value: null, source: "none" };
  // Pas de repli "réglages généraux du club" pour la durée d'un match :
  // contrairement au délai de RDV, aucune durée de référence n'existe déjà
  // dans le produit (§10 — ne pas inventer une durée arbitraire). Sans
  // modèle ni équipe configurés, la fin reste simplement non renseignée.
  if (input.templateDurationMinutes != null) return { value: shiftTime(input.kickoffTime, input.templateDurationMinutes), source: "template" };
  if (input.teamDurationMinutes != null) return { value: shiftTime(input.kickoffTime, input.teamDurationMinutes), source: "team" };
  return { value: null, source: "none" };
}

export function resolveEstimatedReturn(input: {
  estimatedEnd: string | null; // sortie de resolveEstimatedEnd — jamais recalculée séparément
  override: string | null;
  templateReturnDelayMinutes: number | null;
  teamReturnDelayMinutes: number | null;
}): Resolved<string | null> {
  if (input.override) return { value: input.override, source: "match" };
  if (!input.estimatedEnd) return { value: null, source: "none" };
  if (input.templateReturnDelayMinutes != null) return { value: shiftTime(input.estimatedEnd, input.templateReturnDelayMinutes), source: "template" };
  if (input.teamReturnDelayMinutes != null) return { value: shiftTime(input.estimatedEnd, input.teamReturnDelayMinutes), source: "team" };
  return { value: null, source: "none" };
}

/** Résolution générique pour les champs texte simples (transport, tenue, matériel, repas, consignes) — pas de calcul, juste la priorité match > template > team. */
export function resolveField<T>(match: T | null | undefined, template: T | null | undefined, team: T | null | undefined): Resolved<T | null> {
  if (match != null && match !== "") return { value: match, source: "match" };
  if (template != null && template !== "") return { value: template, source: "template" };
  if (team != null && team !== "") return { value: team, source: "team" };
  return { value: null, source: "none" };
}

/**
 * Sélection automatique du modèle à la création (§8) : correspondance
 * exacte competition+isHome d'abord (ex. "Championnat" + extérieur →
 * "Championnat — Extérieur"), puis un modèle "toutes issues confondues"
 * pour cette compétition (isHome: null, ex. Tournoi), sinon aucun modèle —
 * jamais imposé, toujours modifiable ensuite par le coach.
 */
export function selectMatchTemplate<T extends { competition: string | null; isHome: boolean | null }>(
  templates: T[],
  match: { competition: string; isHome: boolean }
): T | null {
  const exact = templates.find((t) => t.competition === match.competition && t.isHome === match.isHome);
  if (exact) return exact;
  const competitionOnly = templates.find((t) => t.competition === match.competition && t.isHome === null);
  return competitionOnly ?? null;
}

export type ParentInfoCompleteness = { filled: number; total: number; percent: number };

/**
 * Indicateur de complétude (§20) — sur les champs "infos parents" qu'un
 * parent voit réellement sur sa fiche de convocation (voir
 * src/app/parent/(app)/matchs/[matchId]/page.tsx, où chaque champ vide est
 * simplement masqué). Ni preMatchObjective/mainInstructions/preMatchNotes
 * (jamais montrés aux parents) ni surface (secondaire) n'entrent dans le
 * calcul.
 */
export function computeParentInfoCompleteness(match: {
  meetTime: string | null;
  location: string | null;
  venueAddress: string | null;
  estimatedEndTime: string | null;
  estimatedReturnTime: string | null;
  transportMode: string | null;
  dressCode: string | null;
  personalGear: string | null;
  mealInfo: string | null;
  parentInstructions: string | null;
}): ParentInfoCompleteness {
  const fields = [
    match.meetTime,
    match.location || match.venueAddress,
    match.estimatedEndTime,
    match.estimatedReturnTime,
    match.transportMode,
    match.dressCode,
    match.personalGear,
    match.mealInfo,
    match.parentInstructions,
  ];
  const total = fields.length;
  const filled = fields.filter((f) => f != null && f !== "").length;
  return { filled, total, percent: Math.round((filled / total) * 100) };
}
