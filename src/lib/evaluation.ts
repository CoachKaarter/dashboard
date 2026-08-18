/**
 * Pré-V5 hardening (Partie F) — the évolution shown on the player's
 * Performance tab must compare a dimension's CURRENT value against that
 * SAME dimension's value in the previous period, never against the
 * previous period's overall average ("moyenne").
 */
export type EvaluationDimension = "technique" | "tactique" | "physique" | "comportement";

export type DimensionScores = Record<EvaluationDimension, number>;

/** Rounded to one decimal, matching the display precision used elsewhere. */
export function computeEvaluationDelta(
  current: DimensionScores,
  previous: DimensionScores | null | undefined,
  dimension: EvaluationDimension
): number {
  const prevValue = previous ? previous[dimension] : current[dimension];
  return Math.round((current[dimension] - prevValue) * 10) / 10;
}
