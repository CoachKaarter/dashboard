import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getAllPlayerStats } from "@/lib/stats";
import { formatDateShort } from "@/lib/format";

export type AlertTone = "red" | "orange" | "green" | "blue";

export type Alert = {
  key: string;
  tag: string;
  title: string;
  detail: string;
  meta: string;
  action: string;
  href: string;
  treated: boolean;
};

export type AlertGroup = {
  key: "urgent" | "traiter" | "surveiller" | "information";
  title: string;
  hint: string;
  tone: AlertTone;
  items: Alert[];
};

async function computeAlertGroups(): Promise<AlertGroup[]> {
  const settings = await getSettings();
  const now = new Date();
  const treatedRows = await prisma.alertTreated.findMany({ select: { alertKey: true } });
  const treatedSet = new Set(treatedRows.map((r) => r.alertKey));

  const urgent: Alert[] = [];
  const traiter: Alert[] = [];
  const surveiller: Alert[] = [];
  const information: Alert[] = [];

  const upcomingMatches = await prisma.match.findMany({
    where: { status: "Planifié" },
    include: { team: true, convocations: true },
    orderBy: { date: "asc" },
  });

  for (const m of upcomingMatches) {
    const daysUntil = Math.round((m.date.getTime() - now.getTime()) / 86400000);
    if (!m.opponent) {
      const key = `match-no-opp:${m.id}`;
      urgent.push({
        key,
        tag: m.team.code,
        title: `${m.team.code} — aucun match enregistré ${formatDateShort(m.date)}`,
        detail: `Aucun adversaire, aucun horaire, aucun lieu saisis pour la journée du ${formatDateShort(m.date)}.`,
        meta: daysUntil <= 0 ? "J-0" : `J-${daysUntil}`,
        action: "Ajouter un match",
        href: "/matchs",
        treated: treatedSet.has(key),
      });
    } else if (m.convocations.length < m.needed) {
      const key = `convoc-incomplete:${m.id}`;
      traiter.push({
        key,
        tag: m.team.code,
        title: `${m.team.code} — convocation incomplète`,
        detail: `${m.convocations.length} joueurs convoqués sur ${m.needed} attendus face à ${m.opponent}.`,
        meta: m.time ?? "",
        action: "Compléter",
        href: `/matchs/${m.id}`,
        treated: treatedSet.has(key),
      });
    }
  }

  const playerStats = await getAllPlayerStats();

  for (const p of playerStats) {
    if (p.status !== "Actif") continue;
    if (p.seances > 0 && p.attendanceRate < settings.seuilPresence / 100) {
      const key = `low-attendance:${p.id}`;
      traiter.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — assiduité sous le seuil`,
        detail: `${Math.round(p.attendanceRate * 100)}% de présence sur ${p.seances} séances (seuil fixé à ${settings.seuilPresence}%).`,
        meta: `${p.anj} ANJ`,
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
      });
    }
  }

  playerStats
    .filter((p) => p.status === "Actif" && p.matchsJoues > 0 && p.ecart < -settings.ecartTdj)
    .sort((a, b) => a.ecart - b.ecart)
    .slice(0, 3)
    .forEach((p) => {
      const key = `low-minutes:${p.id}`;
      const pctVsAvg = p.teamAvgMinutes ? Math.round((100 * p.ecart) / p.teamAvgMinutes) : 0;
      surveiller.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — temps de jeu faible`,
        detail: `${p.minutes} minutes sur la saison, soit ${pctVsAvg}% par rapport à la moyenne ${p.teamCode}.`,
        meta: `${p.matchsJoues} matchs`,
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
      });
    });

  playerStats
    .filter((p) => p.status === "Actif" && (p.lastEvalDaysAgo === null || p.lastEvalDaysAgo > settings.delaiEval))
    .slice(0, 2)
    .forEach((p) => {
      const key = `stale-eval:${p.id}`;
      information.push({
        key,
        tag: p.teamCode,
        title:
          p.lastEvalDaysAgo === null
            ? `${p.firstName} — jamais évalué`
            : `${p.firstName} — non évalué depuis ${p.lastEvalDaysAgo} jours`,
        detail:
          p.lastEvalDaysAgo === null
            ? "Aucune évaluation enregistrée pour ce joueur."
            : `Dernière évaluation : période ${p.currentEval?.period}.`,
        meta: "Éval.",
        action: "Évaluer",
        href: "/evaluations",
        treated: treatedSet.has(key),
      });
    });

  const lateJerseys = await prisma.jersey.findMany({
    where: { returnedDate: null, dueDate: { lt: now } },
    include: { team: true },
  });
  if (lateJerseys.length) {
    const key = "late-jerseys";
    const teams = [...new Set(lateJerseys.map((j) => j.team.code))].join(" et ");
    const maxLate = Math.max(
      ...lateJerseys.map((j) => Math.round((now.getTime() - j.dueDate.getTime()) / 86400000))
    );
    information.push({
      key,
      tag: "MAT",
      title: `${lateJerseys.length} sac${lateJerseys.length > 1 ? "s" : ""} de maillots non rendu${lateJerseys.length > 1 ? "s" : ""}`,
      detail: `${teams} — retour attendu, aucun retour enregistré à ce jour.`,
      meta: `+${maxLate} j`,
      action: "Voir le matériel",
      href: "/materiel",
      treated: treatedSet.has(key),
    });
  }

  return (
    [
      { key: "urgent", title: "Urgent", hint: "à régler dès que possible", tone: "red", items: urgent },
      { key: "traiter", title: "À traiter", hint: "avant le prochain match", tone: "orange", items: traiter.slice(0, 6) },
      { key: "surveiller", title: "À surveiller", hint: "tendance sur plusieurs semaines", tone: "green", items: surveiller },
      { key: "information", title: "Information", hint: "sans urgence", tone: "blue", items: information },
    ] satisfies AlertGroup[]
  ).filter((g) => g.items.length);
}

export const getAlertGroups = cache(computeAlertGroups);

export async function toggleAlertTreated(key: string, userId: string) {
  const existing = await prisma.alertTreated.findUnique({ where: { alertKey: key } });
  if (existing) {
    await prisma.alertTreated.delete({ where: { alertKey: key } });
  } else {
    await prisma.alertTreated.create({ data: { alertKey: key, treatedById: userId } });
  }
}

export type DataCheck = { label: string; value: number; ok: boolean };

async function computeDataChecks(): Promise<DataCheck[]> {
  const players = await prisma.player.findMany({ select: { firstName: true, lastName: true, birthYear: true } });
  const seen = new Set<string>();
  let dupes = 0;
  for (const p of players) {
    const k = `${p.firstName}|${p.lastName}|${p.birthYear}`;
    if (seen.has(k)) dupes++;
    seen.add(k);
  }

  const badMatches = await prisma.match.count({
    where: { status: "Planifié", OR: [{ opponent: null }, { time: null }] },
  });

  const unpointedSessions = await prisma.trainingSession.count({
    where: { status: "Réalisée", attendances: { none: {} } },
  });

  const playedMatches = await prisma.match.findMany({
    where: { status: "Joué" },
    include: { _count: { select: { stats: true } } },
  });
  const incompleteSheets = playedMatches.filter((m) => m._count.stats === 0).length;

  return [
    { label: "Identifiants joueurs en double", value: dupes, ok: dupes === 0 },
    { label: "Matchs sans adversaire ou sans heure", value: badMatches, ok: badMatches === 0 },
    { label: "Séances passées non pointées", value: unpointedSessions, ok: unpointedSessions === 0 },
    { label: "Feuilles de match incomplètes", value: incompleteSheets, ok: incompleteSheets === 0 },
  ];
}

export const getDataChecks = cache(computeDataChecks);
