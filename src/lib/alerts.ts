import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getAllPlayerStats } from "@/lib/stats";
import { formatDateShort } from "@/lib/format";

export type AlertTone = "red" | "orange" | "green" | "blue";

export type AlertDecision = {
  status: string; // "TRAITE" | "ASSUME" | "IGNORE" | "REVOIR"
  snoozeUntil: Date | null;
  comment: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  treatedByName: string | null;
  treatedAt: Date;
};

export type Alert = {
  key: string;
  tag: string;
  title: string;
  detail: string;
  meta: string;
  action: string;
  href: string;
  treated: boolean;
  decision: AlertDecision | null;
};

export type AlertGroup = {
  key: "urgent" | "traiter" | "surveiller" | "information";
  title: string;
  hint: string;
  tone: AlertTone;
  items: Alert[];
};

type Scope = string[] | "ALL";

async function computeAlertGroups(scope: Scope = "ALL"): Promise<AlertGroup[]> {
  const settings = await getSettings();
  const now = new Date();
  const treatedRows = await prisma.alertTreated.findMany({
    include: { assignedTo: true, treatedBy: true },
  });
  const decisionByKey = new Map<string, AlertDecision>(
    treatedRows.map((r) => [
      r.alertKey,
      {
        status: r.status,
        snoozeUntil: r.snoozeUntil,
        comment: r.comment,
        assignedToId: r.assignedToId,
        assignedToName: r.assignedTo?.name ?? null,
        treatedByName: r.treatedBy?.name ?? null,
        treatedAt: r.treatedAt,
      },
    ])
  );
  // Hidden from the active count only while the decision is still in effect:
  // TRAITE/ASSUME are permanent, IGNORE/REVOIR expire once snoozeUntil passes.
  function isActiveDecision(d: AlertDecision) {
    if (d.status === "IGNORE" || d.status === "REVOIR") return !d.snoozeUntil || d.snoozeUntil > now;
    return true;
  }
  const treatedSet = new Set(
    [...decisionByKey.entries()].filter(([, d]) => isActiveDecision(d)).map(([k]) => k)
  );
  function decisionFor(key: string) {
    return decisionByKey.get(key) ?? null;
  }

  const urgent: Alert[] = [];
  const traiter: Alert[] = [];
  const surveiller: Alert[] = [];
  const information: Alert[] = [];

  const upcomingMatches = await prisma.match.findMany({
    where: scope === "ALL" ? { status: "Planifié" } : { status: "Planifié", teamId: { in: scope } },
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
        decision: decisionFor(key),
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
        decision: decisionFor(key),
      });
    }
  }

  const allPlayerStats = await getAllPlayerStats();
  const playerStats = scope === "ALL" ? allPlayerStats : allPlayerStats.filter((p) => scope.includes(p.teamId));

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
        decision: decisionFor(key),
      });
    }
    if (p.recentANJ >= settings.seuilANJ) {
      const key = `anj-recent:${p.id}`;
      urgent.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — absences non justifiées répétées`,
        detail: `${p.recentANJ} absences non justifiées sur les ${settings.fenetreSeances} dernières séances (seuil fixé à ${settings.seuilANJ}).`,
        meta: `${p.recentANJ} ANJ`,
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    } else if (p.recentAbsences >= settings.absRecentes) {
      const key = `abs-recent:${p.id}`;
      traiter.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — absences récentes`,
        detail: `${p.recentAbsences} absences sur les ${settings.fenetreSeances} dernières séances (seuil fixé à ${settings.absRecentes}).`,
        meta: `${p.recentAbsences} abs.`,
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
    if (p.lastConvocDaysAgo === null || p.lastConvocDaysAgo > settings.delaiConvoc) {
      const key = `no-convoc:${p.id}`;
      surveiller.push({
        key,
        tag: p.teamCode,
        title: p.lastConvocDaysAgo === null ? `${p.firstName} — jamais convoqué` : `${p.firstName} — non convoqué depuis ${p.lastConvocDaysAgo} jours`,
        detail: `Délai sans convocation fixé à ${settings.delaiConvoc} jours.`,
        meta: "Convoc.",
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
    if (p.matchsJoues > 0 && p.minutes / p.matchsJoues < settings.minMinutes) {
      const key = `low-rotation:${p.id}`;
      surveiller.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — sous le minimum de rotation`,
        detail: `${Math.round(p.minutes / p.matchsJoues)} minutes en moyenne par match, sous le repère de ${settings.minMinutes} minutes.`,
        meta: `${p.matchsJoues} matchs`,
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
  }

  const teamsForHorizon = await prisma.team.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    include: { matches: { where: { status: "Planifié" }, orderBy: { date: "asc" }, take: 1 } },
  });
  for (const t of teamsForHorizon) {
    const next = t.matches[0];
    const daysUntil = next ? Math.round((next.date.getTime() - now.getTime()) / 86400000) : null;
    if (daysUntil === null || daysUntil > settings.horizonMatch) {
      const key = `no-match-horizon:${t.id}`;
      information.push({
        key,
        tag: t.code,
        title: `${t.code} — aucun match dans les ${settings.horizonMatch} prochains jours`,
        detail: daysUntil === null ? "Aucun match planifié pour cette équipe." : `Prochain match dans ${daysUntil} jours.`,
        meta: "Horizon",
        action: "Voir les matchs",
        href: "/matchs",
        treated: treatedSet.has(key),
        decision: decisionFor(key),
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
        decision: decisionFor(key),
      });
    });

  playerStats
    .filter((p) => p.status === "Actif" && p.matchsJoues > 0 && p.ecart > settings.ecartTdj)
    .sort((a, b) => b.ecart - a.ecart)
    .slice(0, 3)
    .forEach((p) => {
      const key = `surutilise:${p.id}`;
      const pctVsAvg = p.teamAvgMinutes ? Math.round((100 * p.ecart) / p.teamAvgMinutes) : 0;
      surveiller.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — temps de jeu très au-dessus de la moyenne`,
        detail: `${p.minutes} minutes sur la saison, soit +${pctVsAvg}% par rapport à la moyenne ${p.teamCode}. Pense à faire tourner.`,
        meta: `${p.matchsJoues} matchs`,
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    });

  playerStats
    .filter((p) => p.status === "Actif" && p.trend === "décroche")
    .slice(0, 3)
    .forEach((p) => {
      const key = `decroche:${p.id}`;
      traiter.push({
        key,
        tag: p.teamCode,
        title: `${p.firstName} — décroche`,
        detail: `Temps de jeu récent nettement inférieur à son total saison — signe de perte de rythme ou de motivation à surveiller.`,
        meta: "Tendance",
        action: "Voir le joueur",
        href: `/joueurs/${p.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    });

  const teamsForRoster = await prisma.team.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    include: {
      players: { where: { archived: false, status: "Actif" }, select: { position: true } },
      matches: { where: { status: "Planifié" }, orderBy: { date: "asc" }, take: 1 },
    },
  });
  for (const t of teamsForRoster) {
    const filled = t.players.filter((p) => p.position !== "Non renseigné");
    if (filled.length >= 5 && !filled.some((p) => p.position === "Gardien")) {
      const key = `no-keeper:${t.id}`;
      information.push({
        key,
        tag: t.code,
        title: `${t.code} — aucun gardien identifié dans l'effectif`,
        detail: "Aucun joueur de cette équipe n'a le poste « Gardien » renseigné. Vérifie la répartition des postes.",
        meta: "Postes",
        action: "Voir l'équipe",
        href: `/equipes/${t.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }

    const next = t.matches[0];
    if (next && t.players.length < next.needed) {
      const key = `effectif-insuffisant:${t.id}`;
      urgent.push({
        key,
        tag: t.code,
        title: `${t.code} — effectif insuffisant pour le prochain match`,
        detail: `${t.players.length} joueurs actifs disponibles pour ${next.needed} nécessaires face à ${next.opponent ?? "l'adversaire"} le ${formatDateShort(next.date)}.`,
        meta: formatDateShort(next.date),
        action: "Voir le match",
        href: `/matchs/${next.id}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
  }

  let allowedCategories: Set<string> | null = null;
  if (scope !== "ALL") {
    const scopedTeams = await prisma.team.findMany({ where: { id: { in: scope } }, select: { category: true } });
    allowedCategories = new Set(scopedTeams.map((t) => t.category));
  }
  const unpointedSessionsAll = await prisma.trainingSession.findMany({
    where: { status: "Prévue", date: { lt: now } },
    include: { scopeTeam: true },
    orderBy: { date: "desc" },
    take: 30,
  });
  const unpointedSessions = unpointedSessionsAll
    .filter((s) => (scope === "ALL" ? true : s.scopeTeamId ? scope.includes(s.scopeTeamId) : allowedCategories!.has(s.category)))
    .slice(0, 5);
  for (const s of unpointedSessions) {
    const key = `unpointed-session:${s.id}`;
    traiter.push({
      key,
      tag: s.scopeTeam?.code ?? s.category,
      title: `Séance du ${formatDateShort(s.date)} non pointée`,
      detail: `${s.label} — ${s.startTime} · ${s.location}. Le pointage n'a jamais été fait pour cette séance passée.`,
      meta: "Pointage",
      action: "Pointer",
      href: `/seances/${s.id}`,
      treated: treatedSet.has(key),
      decision: decisionFor(key),
    });
  }

  // ---------- Espace Parents : douleurs, indisponibilités déclarées, disponibilités manquantes ----------

  const recentFeedbackCutoff = new Date(now);
  recentFeedbackCutoff.setDate(recentFeedbackCutoff.getDate() - 10);
  const recentFeedbackAll = await prisma.sessionFeedback.findMany({
    where: {
      OR: [{ preAnsweredAt: { gte: recentFeedbackCutoff } }, { postAnsweredAt: { gte: recentFeedbackCutoff } }],
    },
    include: { player: { include: { team: true } } },
    orderBy: { preAnsweredAt: "desc" },
  });
  const recentFeedback =
    scope === "ALL" ? recentFeedbackAll : recentFeedbackAll.filter((f) => scope.includes(f.player.teamId));

  for (const f of recentFeedback) {
    if (f.pain) {
      const key = `pain-reported:${f.id}`;
      urgent.push({
        key,
        tag: f.player.team.code,
        title: `${f.player.firstName} ${f.player.lastName} — douleur signalée`,
        detail: f.painLocation ? `Douleur signalée : ${f.painLocation}` : "Douleur signalée avant la séance, sans précision.",
        meta: "Douleur",
        action: "Voir le joueur",
        href: `/joueurs/${f.playerId}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
    if (f.rpe && f.rpe >= 8) {
      const key = `high-rpe:${f.id}`;
      traiter.push({
        key,
        tag: f.player.team.code,
        title: `${f.player.firstName} ${f.player.lastName} — difficulté perçue très élevée`,
        detail: `RPE ${f.rpe}/10 rapporté après la séance.`,
        meta: `RPE ${f.rpe}`,
        action: "Voir le joueur",
        href: `/joueurs/${f.playerId}`,
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
  }

  // Fatigue élevée répétée : au moins 2 réponses "Beaucoup" sur les 10 derniers jours pour le même joueur.
  const fatigueByPlayer = new Map<string, { count: number; player: (typeof recentFeedback)[number]["player"] }>();
  for (const f of recentFeedback) {
    if (f.fatigue !== "Beaucoup") continue;
    const cur = fatigueByPlayer.get(f.playerId) ?? { count: 0, player: f.player };
    cur.count++;
    fatigueByPlayer.set(f.playerId, cur);
  }
  for (const [playerId, { count, player }] of fatigueByPlayer) {
    if (count < 2) continue;
    const key = `repeated-fatigue:${playerId}`;
    traiter.push({
      key,
      tag: player.team.code,
      title: `${player.firstName} ${player.lastName} — fatigue élevée répétée`,
      detail: `${count} séances récentes avec une fatigue déclarée "Beaucoup".`,
      meta: "Fatigue",
      action: "Voir le joueur",
      href: `/joueurs/${playerId}`,
      treated: treatedSet.has(key),
      decision: decisionFor(key),
    });
  }

  const pendingUnavailAll = await prisma.unavailability.findMany({
    where: { status: "PENDING" },
    include: { player: { include: { team: true } } },
    orderBy: { createdAt: "desc" },
  });
  const pendingUnavail = scope === "ALL" ? pendingUnavailAll : pendingUnavailAll.filter((u) => scope.includes(u.player.teamId));
  for (const u of pendingUnavail) {
    const key = `pending-unavailability:${u.id}`;
    urgent.push({
      key,
      tag: u.player.team.code,
      title: `${u.player.firstName} ${u.player.lastName} — indisponibilité déclarée par la famille`,
      detail: `${u.type}, depuis le ${formatDateShort(u.startDate)} — en attente de validation.`,
      meta: "À valider",
      action: "Voir le joueur",
      href: `/joueurs/${u.playerId}`,
      treated: treatedSet.has(key),
      decision: decisionFor(key),
    });
  }

  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const soonClosingWindows = await prisma.weeklyAvailabilityWindow.findMany({
    where: { status: "OPEN", closesAt: { gte: now, lte: in24h } },
  });
  for (const w of soonClosingWindows) {
    const playersInScope = scope === "ALL" ? await prisma.player.count({ where: { archived: false } }) : await prisma.player.count({ where: { archived: false, teamId: { in: scope } } });
    const answeredPlayerIds = new Set(
      (await prisma.playerAvailability.findMany({ where: { weekStartDate: w.weekStartDate }, select: { playerId: true } })).map((a) => a.playerId)
    );
    const missing = playersInScope - answeredPlayerIds.size;
    if (missing > 0) {
      const key = `missing-availability:${w.id}`;
      traiter.push({
        key,
        tag: "Dispo.",
        title: `${missing} joueur${missing > 1 ? "s" : ""} sans réponse avant la clôture`,
        detail: `La fenêtre de disponibilité de la semaine du ${formatDateShort(w.weekStartDate)} clôture bientôt.`,
        meta: "Clôture proche",
        action: "Voir les réponses",
        href: "/disponibilites",
        treated: treatedSet.has(key),
        decision: decisionFor(key),
      });
    }
  }

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
        decision: decisionFor(key),
      });
    });

  const lateJerseys = await prisma.jersey.findMany({
    where:
      scope === "ALL"
        ? { returnedDate: null, dueDate: { lt: now } }
        : { returnedDate: null, dueDate: { lt: now }, teamId: { in: scope } },
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
        decision: decisionFor(key),
    });
  }

  return (
    [
      { key: "urgent", title: "Urgent", hint: "à régler dès que possible", tone: "red", items: urgent.slice(0, 10) },
      { key: "traiter", title: "À traiter", hint: "avant le prochain match", tone: "orange", items: traiter.slice(0, 6) },
      { key: "surveiller", title: "À surveiller", hint: "tendance sur plusieurs semaines", tone: "green", items: surveiller.slice(0, 8) },
      { key: "information", title: "Information", hint: "sans urgence", tone: "blue", items: information.slice(0, 8) },
    ] satisfies AlertGroup[]
  ).filter((g) => g.items.length);
}

export const getAlertGroups = cache(computeAlertGroups);
export type { Scope as AlertScope };

export async function setAlertDecision(
  key: string,
  userId: string,
  data: { status: string; snoozeUntil?: Date | null; comment?: string | null; assignedToId?: string | null }
) {
  await prisma.alertTreated.upsert({
    where: { alertKey: key },
    update: {
      status: data.status,
      snoozeUntil: data.snoozeUntil ?? null,
      comment: data.comment ?? null,
      assignedToId: data.assignedToId ?? null,
      treatedById: userId,
      treatedAt: new Date(),
    },
    create: {
      alertKey: key,
      status: data.status,
      snoozeUntil: data.snoozeUntil ?? null,
      comment: data.comment ?? null,
      assignedToId: data.assignedToId ?? null,
      treatedById: userId,
    },
  });
}

export async function clearAlertDecision(key: string) {
  await prisma.alertTreated.deleteMany({ where: { alertKey: key } });
}

export type DataCheck = { label: string; value: number; ok: boolean };

async function computeDataChecks(scope: Scope = "ALL"): Promise<DataCheck[]> {
  const teamFilter = scope === "ALL" ? {} : { teamId: { in: scope } };
  const players = await prisma.player.findMany({
    where: teamFilter,
    select: { firstName: true, lastName: true, birthYear: true },
  });
  const seen = new Set<string>();
  let dupes = 0;
  for (const p of players) {
    const k = `${p.firstName}|${p.lastName}|${p.birthYear}`;
    if (seen.has(k)) dupes++;
    seen.add(k);
  }

  const badMatches = await prisma.match.count({
    where: { status: "Planifié", OR: [{ opponent: null }, { time: null }], ...teamFilter },
  });

  const unpointedSessions = await prisma.trainingSession.count({
    where:
      scope === "ALL"
        ? { status: "Réalisée", attendances: { none: {} } }
        : { status: "Réalisée", attendances: { none: {} }, OR: [{ scopeTeamId: { in: scope } }, { scopeTeamId: null }] },
  });

  const playedMatches = await prisma.match.findMany({
    where: { status: "Joué", ...teamFilter },
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
