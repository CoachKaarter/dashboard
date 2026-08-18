/**
 * V5.1 Partie AD/AG — the composition player pool for a given match must be
 * exactly its MatchConvocation rows (never another match's), split into
 * bench (convoqué, not yet placed) vs already-placed. Extracted as a pure
 * function so the "no cross-match leak" and "no double slot" invariants are
 * directly testable without a live database.
 */
export type ConvocatedPlayer = { playerId: string };
export type PlacedSlot = { playerId: string };

export function computeBench<T extends ConvocatedPlayer>(convocations: T[], slots: PlacedSlot[]): T[] {
  const placed = new Set(slots.map((s) => s.playerId));
  return convocations.filter((c) => !placed.has(c.playerId));
}
