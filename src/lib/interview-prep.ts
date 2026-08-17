/**
 * "Préparation automatique" d'un entretien joueur : des chiffres calculés à
 * la volée à partir de données déjà présentes ailleurs (assiduité, wellness,
 * évaluations, entretiens précédents) pour que le coach n'ait pas à
 * reconstituer le contexte de mémoire avant de recevoir un joueur. Rien
 * n'est jamais stocké ni généré par IA — c'est un instantané recalculé à
 * chaque ouverture de l'écran, jamais une synthèse écrite.
 */
import { prisma } from "@/lib/prisma";

const FATIGUE_ORDER: Record<string, number> = { "Pas du tout": 0, "Un peu": 1, "Beaucoup": 2 };

export async function getInterviewPrep(playerId: string) {
  const [lastInterview, objectivesInProgress, recentFeedback] = await Promise.all([
    prisma.playerInterview.findFirst({ where: { playerId }, orderBy: { date: "desc" } }),
    prisma.playerObjective.count({ where: { playerId, status: { in: ["A_TRAVAILLER", "EN_PROGRESSION"] } } }),
    prisma.sessionFeedback.findMany({
      where: { playerId, OR: [{ preAnsweredAt: { not: null } }, { postAnsweredAt: { not: null } }] },
      orderBy: { session: { date: "desc" } },
      take: 5,
      include: { session: true },
    }),
  ]);

  const now = new Date();
  const lastInterviewDaysAgo = lastInterview ? Math.round((now.getTime() - lastInterview.date.getTime()) / 86400000) : null;

  const withPost = recentFeedback.filter((f) => f.postFeeling !== null);
  const avgPostFeeling = withPost.length ? withPost.reduce((s, f) => s + (f.postFeeling ?? 0), 0) / withPost.length : null;
  const withRpe = recentFeedback.filter((f) => f.rpe !== null);
  const avgRpe = withRpe.length ? withRpe.reduce((s, f) => s + (f.rpe ?? 0), 0) / withRpe.length : null;
  const painCount = recentFeedback.filter((f) => f.pain === true).length;
  const highFatigueCount = recentFeedback.filter((f) => f.fatigue && FATIGUE_ORDER[f.fatigue] === 2).length;

  return {
    lastInterview,
    lastInterviewDaysAgo,
    objectivesInProgress,
    wellness: {
      sampleSize: recentFeedback.length,
      avgPostFeeling,
      avgRpe,
      painCount,
      highFatigueCount,
    },
  };
}
