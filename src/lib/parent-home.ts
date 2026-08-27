/**
 * Accueil Parent v2 — assemble en une seule fonction serveur tous les
 * signaux nécessaires au nouvel Accueil : Hero unique (moteur de priorité,
 * src/lib/parent-priority.ts), "À venir", bande de la semaine, et Suivi.
 * Toute la sécurité vit ici, dans les requêtes elles-mêmes — jamais un
 * filtrage côté client après coup : le match d'un enfant n'est visible en
 * détail (adversaire/horaire/lieu/équipe) qu'au travers d'une
 * MatchConvocation qui LUI est destinée, jamais via Player.teamId /
 * Match.teamId (voir src/lib/parent-planning.ts, déjà bâti sur la même
 * règle — reprise ici telle quelle, jamais réinventée).
 */
import { prisma } from "@/lib/prisma";
import { getClub } from "@/lib/club";
import { getWeekStart, getWeekendDate, getWindowForWeek, getPlayerWeekSessions } from "@/lib/availability";
import { isPreOpen, isPostOpen } from "@/lib/session-feedback";
import { getParentPlanItems, type ParentPlanItem } from "@/lib/parent-planning";
import type { AuthedParent } from "@/lib/parent-session";
import {
  loadContentStates,
  getState,
  diffSnapshot,
  isMajorConvocationChange,
  convocationSnapshot,
  sessionSnapshot,
  type EntityRef,
} from "@/lib/parent-content-state";
import {
  buildAvailabilityCard,
  buildConvocationCard,
  buildConvocationWithdrawnCard,
  buildSessionCard,
  buildQuestionnaireCard,
  buildObjectiveCard,
  buildFeedbackCard,
  buildAnnouncementCard,
  buildJerseyBagCard,
  buildParentPriorityFeed,
  type PriorityCard,
} from "@/lib/parent-priority";
import { computeEquipmentDisplayStatus } from "@/lib/equipment";

export type ParentHomeState = {
  clubName: string;
  firstName: string;
  category: string;
  weekLabel: string;
  hero: PriorityCard | null;
  upcoming: ParentPlanItem[]; // "À venir" — 2-3 max, l'événement du Hero déjà exclu
  weekStrip: { date: Date; items: ParentPlanItem[] }[]; // "Cette semaine"
  suivi: {
    objective: { id: string; title: string; category: string; status: string } | null;
    feedback: { id: string; createdAt: Date; comment: string } | null;
  };
  // Formulaire de réponse (§ Cycle 1) — rendu sous le Hero, jamais l'écran
  // entier : le Hero dit déjà "quoi faire", ce bloc est là où on le fait.
  // Masqué dès que tout est répondu (le Hero AVAILABILITY_COMPLETE suffit).
  availabilityForm: {
    weekStartIso: string;
    isLocked: boolean;
    isBeforeOpen: boolean;
    sessions: { id: string; date: Date; startTime: string; endTime: string; location: string; answer?: string; absenceReason?: string | null }[];
    weekendConvocation: null | { matchId: string; teamCode: string; competition: string; opponent: string | null; isHome: boolean; time: string | null; confirmed: boolean | null };
    weekendAnswer?: { status: string; absenceReason?: string | null };
  } | null;
};

export async function getParentHomeState(parent: AuthedParent): Promise<ParentHomeState> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekend = getWeekendDate(weekStart);

  const [
    club,
    window,
    { player, sessions },
    answers,
    weekendConvocation,
    categoryHasWeekendMatch,
    weekendAssignment,
    announcementsPreview,
    objectives,
    latestObjectiveUpdate,
    activeJerseyAssignment,
  ] = await Promise.all([
      getClub(),
      getWindowForWeek(weekStart),
      getPlayerWeekSessions(parent.playerId, weekStart),
      prisma.playerAvailability.findMany({ where: { playerId: parent.playerId, weekStartDate: weekStart } }),
      // Convocation OFFICIELLE de CE joueur — jamais une lecture par équipe.
      prisma.matchConvocation.findFirst({ where: { playerId: parent.playerId, match: { date: weekend } }, include: { match: { include: { team: true } } } }),
      // Existence check (select id) uniquement — jamais de champ du match lui-même avant publication.
      prisma.match.findFirst({ where: { team: { category: parent.player.teamCategory }, date: weekend, status: { not: "Annulé" } }, select: { id: true } }),
      prisma.weekendAssignment.findUnique({ where: { weekendDate_playerId: { weekendDate: weekend, playerId: parent.playerId } } }),
      prisma.staffAnnouncement.findMany({
        where: { OR: [{ scopeTeamId: parent.player.teamId }, { scopeTeamId: null, targetCategory: parent.player.teamCategory }] },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.playerObjective.findMany({
        where: { playerId: parent.playerId, visibleToPlayer: true },
        select: { id: true, title: true, category: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      // "Dernier retour publié" (spec Cycle 13) — le commentaire le plus
      // récent, tous objectifs visibles confondus, pas seulement celui de
      // l'objectif le plus récemment CRÉÉ (deux notions différentes).
      prisma.playerObjectiveUpdate.findFirst({
        where: { objective: { playerId: parent.playerId, visibleToPlayer: true } },
        orderBy: { createdAt: "desc" },
      }),
      // Cockpit v1.1 §7 — seul le compte parent lié au joueur qui a le sac
      // (parentAccountId, jamais déduit du seul playerId) voit ce rappel.
      prisma.equipmentAssignment.findFirst({
        where: { parentAccountId: parent.parentAccountId, status: { not: "RECUPERE_STAFF" } },
        orderBy: { createdAt: "desc" },
        include: { equipment: true },
      }),
    ]);

  const feedbacks = sessions.length
    ? await prisma.sessionFeedback.findMany({ where: { playerId: parent.playerId, sessionId: { in: sessions.map((s) => s.id) } } })
    : [];
  const feedbackBySession = new Map(feedbacks.map((f) => [f.sessionId, f]));
  const answerBySession = new Map(answers.filter((a) => a.sessionId).map((a) => [a.sessionId, a]));
  const weekendAnswer = answers.find((a) => a.type === "WEEKEND");

  // ---- Charger tout l'état NEW/SEEN/COMPLETED en un seul aller-retour ----
  // La convocation est suivie par week-end (entityId = date du samedi), pas
  // par id de MatchConvocation : cela permet de détecter un RETRAIT (le
  // parent avait déjà vu/répondu à une convocation qui a depuis disparu —
  // équipe recomposée, match annulé...) sans dépendre d'une ligne qui,
  // justement, n'existe plus. Voir Cycle 3 "convocation retirée" — ne doit
  // jamais disparaître silencieusement.
  const weekendConvRef: EntityRef = { entityType: "CONVOCATION", entityId: weekend.toISOString() };
  const refs: EntityRef[] = [
    { entityType: "AVAILABILITY_WEEK", entityId: weekStart.toISOString() },
    weekendConvRef,
    ...sessions.map((s) => ({ entityType: "TRAINING_SESSION", entityId: s.id })),
    ...announcementsPreview.map((a) => ({ entityType: "ANNOUNCEMENT", entityId: a.id })),
    ...objectives.map((o) => ({ entityType: "OBJECTIVE", entityId: o.id })),
    ...(latestObjectiveUpdate ? [{ entityType: "OBJECTIVE_UPDATE", entityId: latestObjectiveUpdate.id }] : []),
    ...(activeJerseyAssignment ? [{ entityType: "EQUIPMENT_ASSIGNMENT", entityId: activeJerseyAssignment.id }] : []),
  ];
  const states = await loadContentStates(parent.parentAccountId, refs);

  // ---- Cycle 1 — Disponibilités ----
  const isOpen = window?.status === "OPEN";
  const isLocked = window?.status === "LOCKED";
  const totalSlots = sessions.length + (weekendConvocation ? 0 : 1);
  const answeredCount = sessions.filter((s) => answerBySession.has(s.id)).length + (!weekendConvocation && weekendAnswer ? 1 : 0);
  const availabilityState = getState(states, { entityType: "AVAILABILITY_WEEK", entityId: weekStart.toISOString() });
  const availabilityCard = buildAvailabilityCard({
    weekStartIso: weekStart.toISOString(),
    windowStatus: (window?.status as "CLOSED" | "OPEN" | "LOCKED") ?? "CLOSED",
    closesAt: window?.closesAt ?? null,
    totalSlots,
    answeredCount,
    isNew: !availabilityState?.seenAt,
    now,
  });

  // ---- Cycle 3-6 — Convocation ----
  const weekendConvState = getState(states, weekendConvRef);
  let convocationCard: PriorityCard | null = null;
  if (weekendConvocation) {
    const m = weekendConvocation.match;
    const snapshot = convocationSnapshot({
      date: m.date,
      time: m.time,
      opponent: m.opponent,
      meetTime: m.meetTime,
      meetLocation: m.meetLocation,
      location: m.location,
      estimatedEndTime: m.estimatedEndTime,
      estimatedReturnTime: m.estimatedReturnTime,
      venueAddress: m.venueAddress,
      transportMode: m.transportMode,
      dressCode: m.dressCode,
      personalGear: m.personalGear,
      mealInfo: m.mealInfo,
      parentInstructions: m.parentInstructions,
    });
    const changes = diffSnapshot(weekendConvState?.lastSnapshot, snapshot);
    convocationCard = buildConvocationCard({
      id: weekendConvocation.id,
      matchId: weekendConvocation.matchId,
      teamCode: m.team.code,
      competition: m.competition,
      opponent: m.opponent,
      isHome: m.isHome,
      date: m.date,
      time: m.time,
      meetTime: m.meetTime,
      meetLocation: m.meetLocation,
      location: m.location,
      matchStatus: m.status as "Planifié" | "Joué",
      scoreFor: m.scoreFor,
      scoreAgainst: m.scoreAgainst,
      confirmed: weekendConvocation.confirmed,
      isNew: !weekendConvState?.seenAt,
      changes: changes.map((c) => ({ field: c.field as "date" | "time" | "meetTime" | "meetLocation" | "location" | "opponent", from: c.from, to: c.to })),
      requiresReconfirmation: isMajorConvocationChange(changes),
      now,
    });
    // Le ref exposé au client doit pointer sur la clé de suivi week-end (pas
    // MatchConvocation.id) — c'est elle que markSeen/markResponse mettent à jour.
    if (convocationCard) convocationCard.ref = weekendConvRef;
  } else {
    const snap = weekendConvState?.lastSnapshot;
    const alreadyAcked = !!snap && typeof snap === "object" && "withdrawn" in (snap as object);
    const hadConvocationBefore = !!snap && typeof snap === "object" && !alreadyAcked;
    if (hadConvocationBefore) {
      // Cycle 3 — retrait : le parent avait déjà vu/répondu à une convocation ce
      // week-end, elle a disparu depuis (recomposition, annulation...). Ne
      // disparaît jamais silencieusement.
      convocationCard = buildConvocationWithdrawnCard({ isNew: true, hasReplacement: !!categoryHasWeekendMatch && !!weekendAssignment });
      convocationCard.ref = weekendConvRef;
    }
  }

  // ---- Cycle 7-9 — Séances (annulation / modification / aujourd'hui) ----
  const sessionCards = sessions
    .map((s) => {
      const st = getState(states, { entityType: "TRAINING_SESSION", entityId: s.id });
      const changes = diffSnapshot(st?.lastSnapshot, sessionSnapshot(s));
      const startChange = changes.find((c) => c.field === "startTime");
      return buildSessionCard({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location,
        status: s.status as "Prévue" | "Réalisée" | "Annulée",
        isNew: !st?.seenAt,
        timeChange: startChange ? { from: startChange.from, to: startChange.to } : null,
        now,
      });
    })
    .filter((c): c is PriorityCard => !!c);

  // ---- Cycle 10-11 — Questionnaires ----
  const questionnaireCards = sessions
    .map((s) => {
      const fb = feedbackBySession.get(s.id);
      if (isPreOpen(s, now) && !fb?.preAnsweredAt) return buildQuestionnaireCard({ sessionId: s.id, moment: "pre", href: `/parent/questionnaire/${s.id}/pre` });
      if (isPostOpen(s, now) && !fb?.postAnsweredAt) return buildQuestionnaireCard({ sessionId: s.id, moment: "post", href: `/parent/questionnaire/${s.id}/post` });
      return null;
    })
    .filter((c): c is PriorityCard => !!c);

  // ---- Cycle 12-13 — Objectif / retour coach ----
  const latestObjective = objectives[0] ?? null;
  const objectiveCard = latestObjective
    ? (() => {
        const st = getState(states, { entityType: "OBJECTIVE", entityId: latestObjective.id });
        return buildObjectiveCard({ id: latestObjective.id, title: latestObjective.title, isNew: !st?.seenAt });
      })()
    : null;
  const feedbackCard = latestObjectiveUpdate
    ? (() => {
        const st = getState(states, { entityType: "OBJECTIVE_UPDATE", entityId: latestObjectiveUpdate.id });
        return buildFeedbackCard({ id: latestObjectiveUpdate.id, isNew: !st?.seenAt });
      })()
    : null;

  // ---- Cycle 14 — Annonces ----
  const announcementCards = announcementsPreview.map((a) => {
    const st = getState(states, { entityType: "ANNOUNCEMENT", entityId: a.id });
    return buildAnnouncementCard({ id: a.id, title: a.title, body: a.body, category: a.category, isNew: !st?.seenAt });
  });

  // ---- Cockpit v1.1 §7 — Sac de maillots ----
  const jerseyBagCard = activeJerseyAssignment
    ? (() => {
        const st = getState(states, { entityType: "EQUIPMENT_ASSIGNMENT", entityId: activeJerseyAssignment.id });
        const displayStatus = computeEquipmentDisplayStatus(activeJerseyAssignment, now);
        // Ne peut pas arriver ici (la requête filtre déjà status != RECUPERE_STAFF,
        // et activeJerseyAssignment existe) — garde défensive pure pour le typage.
        if (displayStatus === "A_ATTRIBUER" || displayStatus === "RECUPERE_STAFF") return null;
        return buildJerseyBagCard({
          assignmentId: activeJerseyAssignment.id,
          playerFirstName: player.firstName,
          dueDate: activeJerseyAssignment.dueDate,
          returnLocation: activeJerseyAssignment.returnLocation,
          parentInstructions: activeJerseyAssignment.staffComment,
          displayStatus,
          isNew: !st?.seenAt,
          now,
        });
      })()
    : null;

  // ---- Sélection du Hero unique ----
  const { hero } = buildParentPriorityFeed([
    availabilityCard,
    convocationCard,
    ...sessionCards,
    ...questionnaireCards,
    objectiveCard,
    feedbackCard,
    ...announcementCards,
    jerseyBagCard,
  ]);

  // ---- "À venir" — réutilise le planning existant, exclut l'événement déjà montré en Hero ----
  const to = new Date(now.getTime() + 21 * 86400000);
  const allUpcoming = await getParentPlanItems(parent, now, to);
  const heroMatchId = hero?.ref?.entityType === "CONVOCATION" ? weekendConvocation?.matchId : null;
  const heroSessionId = hero?.ref?.entityType === "TRAINING_SESSION" ? hero.ref.entityId : null;
  const upcoming = allUpcoming.filter((it) => !(it.matchId && it.matchId === heroMatchId) && !(it.kind === "entrainement" && heroSessionId)).slice(0, 3);

  // ---- "Cette semaine" — bande compacte, semaine civile en cours ----
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));
  const weekItems = await getParentPlanItems(parent, weekStart, new Date(weekStart.getTime() + 7 * 86400000));
  const weekStrip = weekDays.map((d) => ({
    date: d,
    items: weekItems.filter((it) => it.date.toDateString() === d.toDateString()),
  }));

  const showAvailabilityForm = (isOpen && answeredCount < totalSlots) || (isLocked && answeredCount < totalSlots);

  return {
    clubName: club.name,
    firstName: player.firstName,
    category: player.team.category,
    weekLabel: `Semaine du ${weekStart.getDate()} au ${weekEndLabel(weekStart)}`,
    hero,
    upcoming,
    weekStrip,
    suivi: {
      objective: latestObjective ? { id: latestObjective.id, title: latestObjective.title, category: latestObjective.category, status: latestObjective.status } : null,
      feedback: latestObjectiveUpdate ? { id: latestObjectiveUpdate.id, createdAt: latestObjectiveUpdate.createdAt, comment: latestObjectiveUpdate.comment } : null,
    },
    availabilityForm: showAvailabilityForm
      ? {
          weekStartIso: weekStart.toISOString(),
          isLocked,
          isBeforeOpen: !isOpen && !isLocked,
          sessions: sessions.map((s) => {
            const a = answerBySession.get(s.id);
            return { id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, location: s.location, answer: a?.status, absenceReason: a?.absenceReason };
          }),
          weekendConvocation: weekendConvocation
            ? {
                matchId: weekendConvocation.matchId,
                teamCode: weekendConvocation.match.team.code,
                competition: weekendConvocation.match.competition,
                opponent: weekendConvocation.match.opponent,
                isHome: weekendConvocation.match.isHome,
                time: weekendConvocation.match.time,
                confirmed: weekendConvocation.confirmed,
              }
            : null,
          weekendAnswer: weekendAnswer ? { status: weekendAnswer.status, absenceReason: weekendAnswer.absenceReason } : undefined,
        }
      : null,
  };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function weekEndLabel(weekStart: Date) {
  const end = new Date(weekStart.getTime() + 6 * 86400000);
  return `${end.getDate()} ${MONTHS[end.getMonth()]}`;
}
