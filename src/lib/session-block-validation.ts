import { z } from "zod";

export const sessionBlockTypeSchema = z.enum([
  "ACCUEIL",
  "ACTIVATION",
  "TECHNIQUE",
  "EXERCICE",
  "SITUATION",
  "JEU",
  "PHYSIQUE",
  "RETOUR_AU_CALME",
  "AUTRE",
]);

export const sessionBlockStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]);

// Real active time tracked client-side (pauses excluded). Generous upper bound
// (6h) — just enough to reject NaN/Infinity/negative/absurd client input,
// never meant to be a tight product constraint.
export const actualDurationMinutesSchema = z.number().finite().min(0).max(360);

// Planned duration entered by the coach when creating/editing a block. Same
// generous 6h ceiling, but strictly positive (a block must last something).
export const durationMinutesSchema = z.number().finite().min(1).max(360);

/**
 * Pure decision for moveBlockUp/moveBlockDown (Partie E) — given the
 * session's blocks (already sorted by `order` asc) and a direction, returns
 * which two blocks must trade `order` values, or null if the move is a
 * no-op (block not found, or already at that edge). Kept separate from the
 * DB transaction (which additionally stages one row through a temporary
 * out-of-range order to avoid colliding with the sessionId+order unique
 * constraint mid-swap) so the ordering logic itself is unit-testable.
 */
export function computeSwapPair<T extends { id: string; order: number }>(
  blocks: T[],
  blockId: string,
  direction: -1 | 1
): { a: T; b: T } | null {
  const i = blocks.findIndex((b) => b.id === blockId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= blocks.length) return null;
  return { a: blocks[i], b: blocks[j] };
}
