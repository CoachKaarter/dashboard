/**
 * V5.1 §57/§58 — pure decision for "Dupliquer le contenu" (Partie M):
 * theme/objective are only copied onto the target session when the target
 * doesn't already have its own — never a silent overwrite of existing data.
 */
export function shouldCopyThemeObjective(target: { theme: string | null; objective: string | null }, source: { theme: string | null; objective: string | null }) {
  return !target.theme && !target.objective && Boolean(source.theme || source.objective);
}
