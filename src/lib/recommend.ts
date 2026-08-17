import type { PlayerWithStats } from "@/lib/stats";

export type ConvocationSuggestion = {
  playerId: string;
  name: string;
  initials: string;
  position: string;
  score: number;
  reasons: string[];
};

/** "AVAILABLE" | "UNAVAILABLE" from PlayerAvailability(type=WEEKEND), absent from the map = no response yet. */
export type WeekendAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";

/**
 * Ranks non-convoked squad members for the next call-up. Pure heuristic
 * scoring — not machine learning — combining rotation gap, attendance,
 * recent reliability, position coverage among already-convoked players, and
 * (when known) the player's own Saturday availability declared by the
 * family, so the explanation stays legible to a coach rather than being a
 * black box.
 *
 * Players who declared themselves UNAVAILABLE for this Saturday are
 * excluded outright — recommending someone who told their family they can't
 * play would make the tool actively wrong, not just imperfect. Players who
 * haven't answered yet are still eligible (excluding them would silently
 * penalize families who are simply slow to respond) but are flagged in
 * their reasons and scored slightly below a confirmed "disponible", so a
 * confirmed player is preferred when the scores would otherwise tie.
 */
export function recommendConvocations(
  squad: PlayerWithStats[],
  convocatedIds: Set<string>,
  needed: number,
  weekendAvailability: Map<string, WeekendAvailabilityStatus> = new Map()
): ConvocationSuggestion[] {
  const convokedPositions = new Map<string, number>();
  for (const p of squad) {
    if (convocatedIds.has(p.id)) convokedPositions.set(p.position, (convokedPositions.get(p.position) ?? 0) + 1);
  }

  const candidates = squad.filter(
    (p) => p.status === "Actif" && !convocatedIds.has(p.id) && weekendAvailability.get(p.id) !== "UNAVAILABLE"
  );

  const scored = candidates.map((p) => {
    let score = 50;
    const reasons: string[] = [];

    // Rotation gap — under-used players get priority.
    if (p.matchsJoues > 0) {
      if (p.ecart < 0) {
        const pct = p.teamAvgMinutes ? Math.round((-100 * p.ecart) / Math.max(1, p.teamAvgMinutes)) : 0;
        score += Math.min(30, Math.abs(p.ecart) / 3);
        if (pct >= 15) reasons.push(`${pct}% sous la moyenne de temps de jeu de l'équipe`);
      } else if (p.ecart > 40) {
        score -= 12;
        reasons.push("déjà nettement au-dessus de la moyenne de temps de jeu");
      }
    }

    // Forgotten players — long since last call-up.
    if (p.lastConvocDaysAgo === null) {
      score += 25;
      reasons.push("jamais convoqué");
    } else if (p.lastConvocDaysAgo >= 14) {
      score += Math.min(20, p.lastConvocDaysAgo / 2);
      reasons.push(`non convoqué depuis ${p.lastConvocDaysAgo} jours`);
    }

    // Attendance — reliable players earn priority.
    if (p.seances >= 3) {
      if (p.attendanceRate >= 0.85) {
        score += 10;
        reasons.push(`${Math.round(p.attendanceRate * 100)}% de présence à l'entraînement`);
      } else if (p.attendanceRate < 0.6) {
        score -= 10;
        reasons.push(`assiduité faible (${Math.round(p.attendanceRate * 100)}%)`);
      }
    }
    if (p.recentAbsences >= 2) {
      score -= p.recentAbsences * 4;
      reasons.push(`${p.recentAbsences} absences récentes`);
    }

    // Position coverage among players already convoked.
    if ((convokedPositions.get(p.position) ?? 0) === 0) {
      score += 8;
      reasons.push(`aucun ${p.position.toLowerCase()} convoqué pour l'instant`);
    }

    // Declared Saturday availability from the family.
    const avail = weekendAvailability.get(p.id);
    if (avail === "AVAILABLE") {
      score += 6;
      reasons.push("disponible confirmé pour le week-end");
    } else if (avail === undefined) {
      score -= 3;
      reasons.push("n'a pas encore répondu pour ce week-end");
    }

    return { playerId: p.id, name: p.name, initials: p.initials, position: p.position, score: Math.round(score), reasons };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, Math.max(needed, 6));
}
