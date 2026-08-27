/**
 * Accueil Parent v2 — moteur de priorité central (spec "REFONDRE
 * L'EXPÉRIENCE UTILISATEUR DE L'ESPACE PARENT..."). Une seule fonction
 * décide ce qui devient le Hero unique de l'écran ; tout le reste
 * (composants React, page.tsx) ne fait qu'afficher son résultat — jamais
 * de `if` de priorité dispersé dans le JSX.
 *
 * Volontairement pur (aucun accès Prisma ici, voir src/lib/parent-home.ts
 * pour l'assemblage des signaux depuis la base) : chaque cycle du spec a sa
 * propre fonction `build*Card`, testable indépendamment, et
 * `buildParentPriorityFeed` ne fait que les collecter et choisir la
 * meilleure. NEW/SEEN/COMPLETED (src/lib/parent-content-state.ts) sont déjà
 * résolus par l'appelant — ces fonctions ne lisent jamais l'heure système
 * pour ça, seulement `now` passé en paramètre (temps Europe/Paris déjà
 * normalisé côté appelant, voir src/lib/timezone.ts).
 *
 * Politique de reconfirmation après modification d'une convocation (spec
 * §17, laissée à notre appréciation, documentée ici comme demandé) :
 *   - Changement MINEUR (meetTime et/ou meetLocation seuls) : la réponse
 *     existante (confirmed) est conservée, la carte redevient visible
 *     brièvement en P3 ("nouveauté"), pas de nouvelle action requise.
 *   - Changement MAJEUR (date, horaire de coup d'envoi, ou adversaire) :
 *     la réponse existante est réputée obsolète (le parent répondait pour
 *     un rendez-vous différent) — la carte remonte en P0 et redemande une
 *     confirmation, même si `confirmed` était déjà renseigné avant le
 *     changement. Le champ `requiresReconfirmation` porte cette décision ;
 *     c'est à l'appelant (parent-home.ts) de traiter `confirmed` comme
 *     "réponse à cette version-ci" uniquement quand `requiresReconfirmation`
 *     est false.
 */

import { matchTypeBadge } from "@/lib/match-phase";

export type PriorityLevel = "P0" | "P1" | "P2" | "P3" | "P4";

export type PriorityCta = { label: string; href?: string; action?: "CONFIRM_PRESENT" | "CONFIRM_ABSENT" | "REPORT_EQUIPMENT_RETURNED" };

export type EntityRef = { entityType: string; entityId: string };

export type PriorityCard = {
  priorityType: string;
  priorityLevel: PriorityLevel;
  isNew: boolean;
  title: string;
  description?: string;
  detail?: string; // ligne secondaire, ex. "Précédemment 09:00"
  cta?: PriorityCta;
  secondaryCta?: PriorityCta;
  ref?: EntityRef; // pour marquer seen/completed après affichage
  date?: Date; // sert au tri "À venir" quand la carte n'est pas retenue comme Hero
  matchId?: string; // convocation uniquement — permet au CTA Présent/Absent d'agir
};

// Ordre de préférence à niveau de priorité égal — du plus important au
// moins important. Un type absent de cette liste est traité en dernier.
const TYPE_RANK: string[] = [
  "SESSION_CANCELLED",
  "CONVOCATION_MODIFIED_MAJOR",
  "JERSEY_BAG_LATE",
  "ANNOUNCEMENT_URGENT",
  "CONVOCATION_WITHDRAWN",
  "CONVOCATION_NEW",
  "CONVOCATION_PENDING",
  "AVAILABILITY_DEADLINE_SOON",
  "AVAILABILITY_LATE",
  "AVAILABILITY_OPEN",
  "JERSEY_BAG_DUE_TODAY",
  "QUESTIONNAIRE_PRE",
  "AVAILABILITY_PARTIAL",
  "SESSION_MODIFIED",
  "MATCH_TODAY",
  "SESSION_TODAY",
  "MATCH_TOMORROW",
  "QUESTIONNAIRE_POST",
  "SESSION_TOMORROW",
  "CONVOCATION_MODIFIED_MINOR",
  "OBJECTIVE_NEW",
  "FEEDBACK_NEW",
  "ANNOUNCEMENT",
  "MATCH_FINISHED",
  "CONVOCATION_CONFIRMED",
  "JERSEY_BAG_HELD",
  "JERSEY_BAG_REPORTED",
  "AVAILABILITY_COMPLETE",
  "AVAILABILITY_CLOSED",
  "NEXT_SESSION",
  "EMPTY",
];

const LEVEL_ORDER: Record<PriorityLevel, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function rankOf(type: string): number {
  const i = TYPE_RANK.indexOf(type);
  return i === -1 ? TYPE_RANK.length : i;
}

/** Sélectionne LA carte Hero parmi tous les candidats présents cette visite. */
export function selectHero(candidates: (PriorityCard | null | undefined)[]): PriorityCard | null {
  const list = candidates.filter((c): c is PriorityCard => !!c);
  if (list.length === 0) return null;
  return [...list].sort((a, b) => LEVEL_ORDER[a.priorityLevel] - LEVEL_ORDER[b.priorityLevel] || rankOf(a.priorityType) - rankOf(b.priorityType))[0];
}

// ---------------------------------------------------------------------
// Cycle 1 — Disponibilités
// ---------------------------------------------------------------------

export type AvailabilityInput = {
  weekStartIso: string;
  windowStatus: "CLOSED" | "OPEN" | "LOCKED";
  closesAt: Date | null;
  totalSlots: number;
  answeredCount: number;
  isNew: boolean; // jamais vue en état OPEN — pour l'animation d'ouverture (état B)
  now: Date;
};

const DEADLINE_SOON_MS = 12 * 60 * 60 * 1000; // "proche" = à moins de 12h — pas de score arbitraire fin, cohérent avec l'échelle du reste (jour même)

export function buildAvailabilityCard(input: AvailabilityInput): PriorityCard | null {
  const { windowStatus, closesAt, totalSlots, answeredCount, isNew, now } = input;
  const ref: EntityRef = { entityType: "AVAILABILITY_WEEK", entityId: input.weekStartIso };
  const href = "/parent#dispos";

  if (windowStatus === "CLOSED") return null; // État A — pas de CTA, jamais un Hero

  if (windowStatus === "LOCKED") {
    if (answeredCount < totalSlots) {
      // État F — encore modifiable en retard : le staff a clos sans que tout soit répondu.
      return {
        priorityType: "AVAILABILITY_LATE",
        priorityLevel: "P1",
        isNew,
        title: "Disponibilités en retard",
        description: `${answeredCount} sur ${totalSlots} renseignées — le staff a clôturé la fenêtre.`,
        cta: { label: "Compléter maintenant", href },
        ref,
      };
    }
    return {
      priorityType: "AVAILABILITY_CLOSED",
      priorityLevel: "P4",
      isNew,
      title: "Disponibilités clôturées",
      description: "Pour un changement, contactez le staff.",
      ref,
    };
  }

  // windowStatus === "OPEN"
  const deadlineSoon = closesAt ? closesAt.getTime() - now.getTime() <= DEADLINE_SOON_MS && closesAt.getTime() > now.getTime() : false;

  if (answeredCount >= totalSlots && totalSlots > 0) {
    // État D — complété : redescend vite, mais reste visible brièvement.
    return {
      priorityType: "AVAILABILITY_COMPLETE",
      priorityLevel: "P4",
      isNew,
      title: "Disponibilités complétées",
      description: "Tout est renseigné.",
      secondaryCta: { label: "Modifier", href },
      ref,
    };
  }

  if (deadlineSoon) {
    // État E — deadline proche, priorité haute même si déjà partiellement répondu.
    return {
      priorityType: "AVAILABILITY_DEADLINE_SOON",
      priorityLevel: "P1",
      isNew,
      title: "Réponse attendue",
      description: closesAt ? `Les disponibilités ferment aujourd'hui à ${fmtHM(closesAt)}.` : "Les disponibilités ferment bientôt.",
      cta: { label: "Renseigner maintenant", href },
      ref,
    };
  }

  if (answeredCount > 0) {
    // État C — partiel.
    return {
      priorityType: "AVAILABILITY_PARTIAL",
      priorityLevel: "P1",
      isNew,
      title: `${answeredCount} sur ${totalSlots} renseignées`,
      description: "Merci de compléter les réponses restantes.",
      cta: { label: "Continuer", href },
      ref,
    };
  }

  // État B — moment d'ouverture, rien répondu.
  return {
    priorityType: "AVAILABILITY_OPEN",
    priorityLevel: "P1",
    isNew,
    title: "Disponibilités ouvertes",
    description: closesAt ? `À compléter avant le ${fmtDayHM(closesAt)}.` : "Merci de renseigner les disponibilités de la semaine.",
    cta: { label: "Renseigner les disponibilités", href },
    ref,
  };
}

// ---------------------------------------------------------------------
// Cycle 3-6 — Convocation (avant publication → après-match)
// ---------------------------------------------------------------------

export type ConvocationChange = { field: "date" | "time" | "meetTime" | "meetLocation" | "location" | "opponent"; from: string; to: string };

export type ConvocationInput = {
  id: string; // MatchConvocation.id
  matchId: string; // Match.id — porté par la carte pour le CTA Présent/Absent
  teamCode: string;
  competition: string; // "Championnat" | "Amical" | "Tournoi" | ... — jamais affiché comme "Match" générique (spec Cockpit v1.1 §2)
  opponent: string | null;
  isHome: boolean;
  date: Date; // Paris midnight du match
  time: string | null; // coup d'envoi
  meetTime: string | null;
  meetLocation: string | null;
  location: string | null;
  matchStatus: "Planifié" | "Joué";
  scoreFor: number | null;
  scoreAgainst: number | null;
  confirmed: boolean | null;
  isNew: boolean; // jamais vue (aucun ParentContentState.seenAt)
  changes: ConvocationChange[]; // vide si rien n'a changé depuis le dernier instantané connu
  requiresReconfirmation: boolean; // cf. politique documentée en tête de fichier
  now: Date;
};

function isSameParisDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function buildConvocationCard(input: ConvocationInput): PriorityCard | null {
  const {
    matchId,
    teamCode,
    competition,
    opponent,
    isHome,
    date,
    time,
    meetTime,
    meetLocation,
    location,
    matchStatus,
    scoreFor,
    scoreAgainst,
    confirmed,
    isNew,
    changes,
    requiresReconfirmation,
    now,
  } = input;
  const ref: EntityRef = { entityType: "CONVOCATION", entityId: input.id };
  const href = `/parent/matchs/${matchId}`;
  const opponentLabel = opponent ?? "adversaire à définir";
  const typeBadge = matchTypeBadge(competition);
  const matchLine = `${typeBadge} · ${teamCode} — ${opponentLabel}`;
  const kickoffLine = [time ? `Coup d'envoi ${time}` : null, meetTime ? `Rendez-vous ${meetTime}` : null, location ?? meetLocation].filter(Boolean).join(" · ");

  // Cycle 6 — après-match : le résultat prime, redescend vite en priorité.
  if (matchStatus === "Joué") {
    if (scoreFor === null || scoreAgainst === null) return null; // pas de score exploitable, rien à montrer ici
    const [forScore, againstScore, us, them] = isHome ? [scoreFor, scoreAgainst, "Saint-Sébastien", opponentLabel] : [scoreAgainst, scoreFor, opponentLabel, "Saint-Sébastien"];
    const label = scoreFor === scoreAgainst ? "Match nul" : (isHome ? scoreFor > scoreAgainst : scoreAgainst > scoreFor) ? "Victoire" : "Défaite";
    return {
      priorityType: "MATCH_FINISHED",
      priorityLevel: "P3",
      isNew,
      title: "Match terminé",
      description: `${us} ${forScore} — ${againstScore} ${them}`,
      detail: label,
      matchId,
      ref,
      date,
    };
  }

  // Modification majeure — reprend la priorité maximale et redemande confirmation.
  if (changes.length > 0 && requiresReconfirmation) {
    const first = changes[0];
    return {
      priorityType: "CONVOCATION_MODIFIED_MAJOR",
      priorityLevel: "P0",
      isNew: true,
      title: "Convocation modifiée",
      description: changeLabel(first),
      detail: matchLine,
      cta: { label: "Voir les informations", href },
      matchId,
      ref,
      date,
    };
  }
  if (changes.length > 0 && !requiresReconfirmation) {
    const first = changes[0];
    return {
      priorityType: "CONVOCATION_MODIFIED_MINOR",
      priorityLevel: "P3",
      isNew: true,
      title: "Convocation mise à jour",
      description: changeLabel(first),
      detail: matchLine,
      cta: { label: "Voir les informations", href },
      matchId,
      ref,
      date,
    };
  }

  // Pas encore de réponse (nouvelle ou vue mais toujours en attente).
  if (confirmed === null || requiresReconfirmation) {
    if (isNew) {
      return {
        priorityType: "CONVOCATION_NEW",
        priorityLevel: "P1",
        isNew: true,
        title: "Nouvelle convocation",
        description: matchLine,
        detail: kickoffLine,
        cta: { label: "Voir ma convocation", href },
        matchId,
        ref,
        date,
      };
    }
    return {
      priorityType: "CONVOCATION_PENDING",
      priorityLevel: "P1",
      isNew: false,
      title: "Réponse attendue",
      description: `${matchLine} — votre enfant sera-t-il présent ?`,
      cta: { label: "Présent", action: "CONFIRM_PRESENT" },
      secondaryCta: { label: "Absent", action: "CONFIRM_ABSENT" },
      matchId,
      ref,
      date,
    };
  }

  if (confirmed === false) {
    return {
      priorityType: "CONVOCATION_DECLINED",
      priorityLevel: "P3",
      isNew,
      title: "Absence renseignée",
      description: "Vous avez indiqué que votre enfant ne sera pas présent.",
      cta: { label: "Modifier ma réponse", href },
      matchId,
      ref,
      date,
    };
  }

  // confirmed === true — présence confirmée : la priorité dépend de la proximité du match.
  const isToday = isSameParisDay(date, now);
  const isTomorrow = isSameParisDay(date, new Date(now.getTime() + 86400000));
  if (isToday) {
    const rdvPassed = meetTime ? hmToMinutes(meetTime) <= now.getHours() * 60 + now.getMinutes() : false;
    return {
      priorityType: "MATCH_TODAY",
      priorityLevel: "P2",
      isNew,
      title: "Aujourd'hui",
      description: `${typeBadge} vs ${opponentLabel} — ${teamCode}`,
      detail: rdvPassed ? `${typeBadge} aujourd'hui à ${time ?? "l'heure prévue"}` : kickoffLine,
      cta: { label: "Voir les informations", href },
      matchId,
      ref,
      date,
    };
  }
  if (isTomorrow) {
    return {
      priorityType: "MATCH_TOMORROW",
      priorityLevel: "P2",
      isNew,
      title: "Demain",
      description: `${teamCode} — ${opponentLabel}`,
      detail: kickoffLine,
      cta: { label: "Voir les informations", href },
      matchId,
      ref,
      date,
    };
  }
  return {
    priorityType: "CONVOCATION_CONFIRMED",
    priorityLevel: "P4",
    isNew,
    title: "Présence confirmée",
    description: matchLine,
    detail: kickoffLine,
    secondaryCta: { label: "Voir les détails", href },
    matchId,
    ref,
    date,
  };
}

/** Cycle 3 — retrait d'une convocation déjà publiée (spec : ne doit jamais disparaître silencieusement). */
export function buildConvocationWithdrawnCard(input: { isNew: boolean; hasReplacement: boolean }): PriorityCard {
  return {
    priorityType: "CONVOCATION_WITHDRAWN",
    priorityLevel: input.isNew ? "P1" : "P3",
    isNew: input.isNew,
    title: "Mise à jour du week-end",
    description: "Votre précédente convocation n'est plus active.",
    detail: input.hasReplacement ? "Nouvelle convocation à venir." : "Pas de convocation ce week-end.",
  };
}

function changeLabel(c: ConvocationChange): string {
  const LABELS: Record<ConvocationChange["field"], string> = {
    date: "Nouvelle date",
    time: "Nouvel horaire",
    meetTime: "Nouveau rendez-vous",
    meetLocation: "Nouveau lieu de rendez-vous",
    location: "Nouveau lieu",
    opponent: "Changement d'adversaire",
  };
  return `${LABELS[c.field]} — ${c.to} (précédemment ${c.from})`;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function fmtHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`;
}
function fmtDayHM(d: Date): string {
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")} à ${fmtHM(d)}`;
}

// ---------------------------------------------------------------------
// Cycle 7-9 — Séance (aujourd'hui / annulation / modification)
// ---------------------------------------------------------------------

export type SessionInput = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  status: "Prévue" | "Réalisée" | "Annulée";
  isNew: boolean;
  timeChange: { from: string; to: string } | null; // horaire modifié depuis le dernier instantané connu
  now: Date;
};

export function buildSessionCard(input: SessionInput): PriorityCard | null {
  const { date, startTime, endTime, location, status, isNew, timeChange, now } = input;
  const ref: EntityRef = { entityType: "TRAINING_SESSION", entityId: input.id };
  const isToday = isSameParisDay(date, now);

  if (status === "Annulée") {
    return {
      priorityType: "SESSION_CANCELLED",
      priorityLevel: isToday ? "P0" : "P1",
      isNew,
      title: "Séance annulée",
      description: isToday ? "La séance prévue aujourd'hui est annulée." : `La séance du ${fmtDay(date)} est annulée.`,
      ref,
      date,
    };
  }

  if (timeChange) {
    return {
      priorityType: "SESSION_MODIFIED",
      priorityLevel: "P1",
      isNew: true,
      title: "Horaire modifié",
      description: `La séance du ${fmtDay(date)} débutera exceptionnellement à ${timeChange.to}.`,
      detail: `Précédemment : ${timeChange.from}`,
      ref,
      date,
    };
  }

  if (isToday) {
    return {
      priorityType: "SESSION_TODAY",
      priorityLevel: "P2",
      isNew,
      title: "Aujourd'hui",
      description: `Entraînement — ${startTime} – ${endTime}`,
      detail: location,
      ref,
      date,
    };
  }

  return {
    priorityType: "SESSION_UPCOMING",
    priorityLevel: "P4",
    isNew,
    title: fmtDay(date),
    description: `Entraînement — ${startTime} – ${endTime}`,
    detail: location,
    ref,
    date,
  };
}

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function fmtDay(d: Date): string {
  const n = DAY_NAMES[d.getDay()];
  return `${n[0].toUpperCase()}${n.slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// ---------------------------------------------------------------------
// Cycle 10-11 — Questionnaires
// ---------------------------------------------------------------------

export type QuestionnaireInput = { sessionId: string; moment: "pre" | "post"; href: string };

export function buildQuestionnaireCard(input: QuestionnaireInput): PriorityCard {
  const ref: EntityRef = { entityType: "TRAINING_SESSION", entityId: input.sessionId };
  if (input.moment === "pre") {
    return {
      priorityType: "QUESTIONNAIRE_PRE",
      priorityLevel: "P1",
      isNew: true,
      title: "Avant la séance",
      description: "Petit questionnaire à compléter.",
      cta: { label: "Répondre", href: input.href },
      ref,
    };
  }
  return {
    priorityType: "QUESTIONNAIRE_POST",
    priorityLevel: "P2",
    isNew: true,
    title: "Retour de séance",
    description: "Comment s'est passée la séance ?",
    cta: { label: "Répondre", href: input.href },
    ref,
  };
}

// ---------------------------------------------------------------------
// Cycle 12-14 — Objectif / retour coach / annonce
// ---------------------------------------------------------------------

export function buildObjectiveCard(input: { id: string; title: string; isNew: boolean }): PriorityCard {
  return {
    priorityType: "OBJECTIVE_NEW",
    priorityLevel: "P3",
    isNew: input.isNew,
    title: "Nouvel objectif",
    description: input.title,
    cta: { label: "Voir le suivi", href: "/parent/suivi" },
    ref: { entityType: "OBJECTIVE", entityId: input.id },
  };
}

export function buildFeedbackCard(input: { id: string; isNew: boolean }): PriorityCard {
  return {
    priorityType: "FEEDBACK_NEW",
    priorityLevel: "P3",
    isNew: input.isNew,
    title: "Nouveau retour",
    description: "Le staff a ajouté un retour sur le suivi de votre enfant.",
    cta: { label: "Voir le suivi", href: "/parent/suivi" },
    ref: { entityType: "OBJECTIVE_UPDATE", entityId: input.id },
  };
}

// StaffAnnouncement.category porte déjà une notion de sévérité — spec §14 :
// "ne crée pas un système de priorité complexe si Announcement possède déjà
// une notion similaire". ANNULATION est la seule catégorie qui justifie de
// remonter au-dessus des simples nouveautés (une annulation méthodologique
// diffusée en texte libre plutôt que via TrainingSession.status).
const ANNOUNCEMENT_LEVEL: Record<string, PriorityLevel> = {
  ANNULATION: "P1",
  TERRAIN: "P3",
  WEEKEND: "P3",
  MESSAGE: "P4",
};

export function buildAnnouncementCard(input: { id: string; title: string; body: string; category: string; isNew: boolean }): PriorityCard {
  const level = ANNOUNCEMENT_LEVEL[input.category] ?? "P3";
  return {
    priorityType: level === "P1" ? "ANNOUNCEMENT_URGENT" : "ANNOUNCEMENT",
    priorityLevel: level,
    isNew: input.isNew,
    title: "Information du club",
    description: input.title,
    detail: input.body,
    cta: { label: "Lire", href: "/parent/infos" },
    ref: { entityType: "ANNOUNCEMENT", entityId: input.id },
  };
}

// ---------------------------------------------------------------------
// Cockpit v1.1 §7 — Matériel confié (sac de maillots)
// ---------------------------------------------------------------------

export type JerseyBagInput = {
  assignmentId: string;
  playerFirstName: string;
  dueDate: Date;
  returnLocation: string | null;
  parentInstructions?: string | null; // consignes de lavage / précisions du staff (staffComment)
  displayStatus: "CHEZ_LE_JOUEUR" | "RETOUR_AUJOURD_HUI" | "EN_RETARD" | "RETOUR_SIGNALE_PARENT";
  isNew: boolean;
  now: Date;
};

const JERSEY_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function fmtJerseyDate(d: Date): string {
  return `${d.getDate()} ${JERSEY_MONTHS[d.getMonth()]}`;
}

/**
 * Seul le compte parent lié au joueur qui a le sac voit cette carte (spec
 * §7) — c'est à l'appelant (parent-home.ts) de ne construire cet input que
 * pour l'attribution active dont parentAccountId correspond au parent
 * connecté ; cette fonction ne fait aucune vérification d'identité, elle
 * n'a pas accès à la base.
 */
export function buildJerseyBagCard(input: JerseyBagInput): PriorityCard {
  const ref: EntityRef = { entityType: "EQUIPMENT_ASSIGNMENT", entityId: input.assignmentId };
  const returnPhrase = input.returnLocation ? `, lors de ${input.returnLocation}` : "";

  if (input.displayStatus === "RETOUR_SIGNALE_PARENT") {
    return {
      priorityType: "JERSEY_BAG_REPORTED",
      priorityLevel: "P3",
      isNew: input.isNew,
      title: "Retour signalé",
      description: "Merci — le staff doit encore confirmer la récupération du sac.",
      ref,
    };
  }

  const dueLine = `Merci de rapporter les maillots lavés le ${fmtJerseyDate(input.dueDate)}${returnPhrase}.`;
  const cta = { label: "J'ai rapporté le sac", action: "REPORT_EQUIPMENT_RETURNED" as const };

  if (input.displayStatus === "EN_RETARD") {
    return {
      priorityType: "JERSEY_BAG_LATE",
      priorityLevel: "P0",
      isNew: input.isNew,
      title: "Sac de maillots en retard",
      description: `Retour attendu depuis le ${fmtJerseyDate(input.dueDate)}${returnPhrase}.`,
      detail: input.parentInstructions ?? undefined,
      cta,
      ref,
    };
  }
  if (input.displayStatus === "RETOUR_AUJOURD_HUI") {
    return {
      priorityType: "JERSEY_BAG_DUE_TODAY",
      priorityLevel: "P1",
      isNew: input.isNew,
      title: "Vous avez le sac de maillots",
      description: dueLine,
      detail: input.parentInstructions ?? undefined,
      cta,
      ref,
    };
  }
  // CHEZ_LE_JOUEUR — pas encore urgent, reste visible mais discret.
  return {
    priorityType: "JERSEY_BAG_HELD",
    priorityLevel: "P3",
    isNew: input.isNew,
    title: "Vous avez le sac de maillots",
    description: dueLine,
    detail: input.parentInstructions ?? undefined,
    cta,
    ref,
  };
}

// ---------------------------------------------------------------------
// Assemblage — Hero unique
// ---------------------------------------------------------------------

export type ParentPriorityFeed = {
  hero: PriorityCard | null;
};

/**
 * Une seule carte Hero, choisie parmi tous les candidats de la visite —
 * jamais plusieurs à la fois même si plusieurs choses sont vraies en même
 * temps (spec : "un seul élément devient le Hero"). En l'absence de tout
 * candidat, retourne null — l'appelant affiche alors l'état calme
 * ("prochain rendez-vous" ou message neutre), jamais un Hero inventé.
 */
export function buildParentPriorityFeed(candidates: (PriorityCard | null | undefined)[]): ParentPriorityFeed {
  return { hero: selectHero(candidates) };
}
