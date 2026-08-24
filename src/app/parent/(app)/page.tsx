import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekendDate, getWindowForWeek, getPlayerWeekSessions } from "@/lib/availability";
import { isPreOpen, isPostOpen } from "@/lib/session-feedback";
import { computeWeekendTimeline } from "@/lib/parent-status-timeline";
import { ANNOUNCEMENT_CATEGORY_LABELS } from "@/lib/announcement-validation";
import { setSessionAvailability, setSessionAbsenceReason, setWeekendAvailability, setWeekendAbsenceReason } from "./actions";
import { ParentHeader } from "@/components/parent/ParentHeader";
import { ParentStatusBanner } from "@/components/parent/ParentStatusBanner";
import { ParentTaskCard } from "@/components/parent/ParentTaskCard";
import { ParentCard } from "@/components/parent/ParentCard";
import { AvailabilityChoice } from "@/components/parent/AvailabilityChoice";
import { QuestionnaireCard } from "@/components/parent/QuestionnaireCard";
import { CheckIcon, ChevronRightIcon } from "@/components/parent/icons";
import type { SessionFeedback } from "@/generated/prisma/client";

const REASONS = ["Maladie", "Famille", "École", "Autre"];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function fmtDay(d: Date) {
  return `${DAY_NAMES[d.getDay()][0].toUpperCase()}${DAY_NAMES[d.getDay()].slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`;
}

export default async function ParentAccueilPage() {
  const parent = await requireParentReady();
  const today = new Date();
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(today);
  const weekend = getWeekendDate(weekStart);
  const weekStartIso = weekStart.toISOString();

  const [window, { player, sessions }, answers, weekendConvocation, categoryHasWeekendMatch, weekendAssignment, weekendPlan, announcementsPreview] = await Promise.all([
    getWindowForWeek(weekStart),
    getPlayerWeekSessions(parent.playerId, weekStart),
    prisma.playerAvailability.findMany({ where: { playerId: parent.playerId, weekStartDate: weekStart } }),
    // Once le staff a publié une convocation officielle pour ce samedi, la
    // question "disponible ce week-end" n'a plus lieu d'être — la réponse
    // qui compte devient "je viens / je ne viens pas" à CE match, gérée
    // dans Planning (§18). Réutilise MatchConvocation, rien de nouveau.
    prisma.matchConvocation.findFirst({ where: { playerId: parent.playerId, match: { date: weekend } }, include: { match: { include: { team: true } } } }),
    // Existence check ONLY (select id) — jamais Match.teamId /
    // parent.player.teamId : avant publication de la convocation, on a le
    // droit de savoir qu'un match a lieu ce week-end pour la catégorie,
    // jamais dans quelle équipe / contre qui. Ce booléen ne sert qu'à
    // afficher (ou non) le bloc "Où en est [prénom]" ci-dessous ; aucun
    // champ de ce match n'est jamais lu ni rendu.
    prisma.match.findFirst({
      where: { team: { category: parent.player.teamCategory }, date: weekend, status: { not: "Annulé" } },
      select: { id: true },
    }),
    prisma.weekendAssignment.findUnique({ where: { weekendDate_playerId: { weekendDate: weekend, playerId: parent.playerId } } }),
    prisma.weekendPlan.findUnique({ where: { weekStartDate: weekStart } }),
    prisma.staffAnnouncement.findMany({
      where: { OR: [{ scopeTeamId: parent.player.teamId }, { scopeTeamId: null, targetCategory: parent.player.teamCategory }] },
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
  ]);
  const feedbacks = sessions.length
    ? await prisma.sessionFeedback.findMany({ where: { playerId: parent.playerId, sessionId: { in: sessions.map((s) => s.id) } } })
    : [];
  const feedbackBySession = new Map(feedbacks.map((f) => [f.sessionId, f]));

  const answerBySession = new Map(answers.filter((a) => a.sessionId).map((a) => [a.sessionId, a]));
  const weekendAnswer = answers.find((a) => a.type === "WEEKEND");

  const isOpen = window?.status === "OPEN";
  const isLocked = window?.status === "LOCKED";
  const isBeforeOpen = !window || window.status === "CLOSED";
  const totalSlots = sessions.length + (weekendConvocation ? 0 : 1);
  const answeredCount = sessions.filter((s) => answerBySession.has(s.id)).length + (!weekendConvocation && weekendAnswer ? 1 : 0);
  const allDone = totalSlots > 0 && answeredCount === totalSlots;

  const playerTasks = sessions.filter((s) => {
    const fb = feedbackBySession.get(s.id);
    return (isPreOpen(s) && !fb?.preAnsweredAt) || (isPostOpen(s) && !fb?.postAnsweredAt);
  });

  const weekendSteps =
    weekendConvocation || categoryHasWeekendMatch
      ? computeWeekendTimeline({
          answered: (weekendAnswer?.status as "AVAILABLE" | "UNAVAILABLE" | undefined) ?? null,
          selectionStarted: !!weekendAssignment || (weekendPlan ? weekendPlan.status !== "DRAFT" : false),
          convoked: !!weekendConvocation,
          convokedTeamCode: weekendConvocation?.match.team.code ?? null,
        })
      : null;

  const upcoming = [
    ...sessions.map((s) => ({ kind: "session" as const, date: s.date, label: "Entraînement", detail: `${s.startTime} · ${s.location}` })),
    // weekendConvocation.match seulement — jamais une lecture de Match par
    // Player.teamId : tant que rien n'est publié pour CE joueur, aucun
    // adversaire/horaire n'apparaît ici.
    ...(weekendConvocation
      ? [
          {
            kind: "match" as const,
            date: weekendConvocation.match.date,
            label: weekendConvocation.match.opponent ?? "Match à définir",
            detail: `${weekendConvocation.match.time ? `Coup d'envoi ${weekendConvocation.match.time}` : "Horaire à confirmer"}${
              weekendConvocation.match.isHome ? "" : " · extérieur"
            }`,
          },
        ]
      : []),
  ]
    .filter((e) => e.date >= todayMidnight)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextEvent = upcoming[0] ?? null;

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentHeader
        firstName={player.firstName}
        category={player.team.category}
        subtitle={`Semaine du ${weekStart.getDate()} au ${weekEndLabel(weekStart)}`}
      />

      {isBeforeOpen && (
        <ParentStatusBanner tone="locked" title="Présences pas encore ouvertes" detail="Le staff ouvrira bientôt le pointage de cette semaine." />
      )}

      {isOpen && !allDone && (
        <ParentStatusBanner
          tone="success"
          title="Présences ouvertes"
          detail={window?.closesAt ? `À compléter avant le ${fmtDay(new Date(window.closesAt))} ${fmtTime(new Date(window.closesAt))}` : undefined}
          progress={{ done: answeredCount, total: totalSlots }}
        />
      )}

      {isOpen && allDone && (
        <ParentStatusBanner tone="success" title="Tout est à jour" detail="Merci, aucune action nécessaire pour cette semaine." />
      )}

      {isLocked && <ParentStatusBanner tone="warning" title="Présences clôturées" detail="Pour un changement, contacte le staff." />}

      {nextEvent && (
        <ParentCard>
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">Prochain événement</div>
          <div className="text-[15px] font-bold mt-0.5">
            {fmtDay(nextEvent.date)} · {nextEvent.label}
          </div>
          <div className="text-[13px] text-[#6E7178] mt-0.5">{nextEvent.detail}</div>
        </ParentCard>
      )}

      {weekendSteps && (
        <ParentCard>
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">
            Où en est {player.firstName} pour {fmtDay(weekend).toLowerCase()} ?
          </div>
          <div className="mt-3 flex flex-col gap-3.5">
            {weekendSteps.map((step, i) => (
              <div key={step.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      step.done ? "bg-green border-green" : "border-[#D5D6D9]"
                    } ${step.current ? "ring-4 ring-green-bg" : ""}`}
                  >
                    {step.done && <CheckIcon size={9} className="text-white" strokeWidth={3} />}
                  </span>
                  {i < weekendSteps.length - 1 && <span className={`w-0.5 h-6 mt-0.5 ${step.done ? "bg-green" : "bg-[#E7E7E2]"}`} />}
                </div>
                <div className="pt-0">
                  <div className={`text-[13.5px] font-bold ${step.done ? "text-[#16181C]" : "text-[#9A9DA3]"}`}>{step.title}</div>
                  <div className="text-[12px] text-[#9A9DA3] mt-0.5">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </ParentCard>
      )}

      {(isOpen ? !allDone : true) && (sessions.length > 0 || !weekendConvocation || playerTasks.length > 0) && (
        <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">
          {isOpen ? "À faire" : isLocked ? "Vos réponses" : "Cette semaine"}
        </div>
      )}

      {sessions.map((s) => {
        const answer = answerBySession.get(s.id);
        const fb = feedbackBySession.get(s.id);
        return (
          <div key={s.id} className="flex flex-col gap-2.5">
            <ParentTaskCard kicker={fmtDay(s.date)} title="Entraînement" detail={`${s.startTime} → ${s.endTime} · ${s.location}`}>
              {isBeforeOpen ? (
                <div className="text-[13px] text-[#8A8D93] italic">Réponse pas encore possible.</div>
              ) : (
                <AvailabilityChoice
                  status={answer?.status as "AVAILABLE" | "UNAVAILABLE" | undefined}
                  onSetStatus={setSessionAvailability.bind(null, s.id)}
                  locked={isLocked}
                  reasons={REASONS}
                  currentReason={answer?.absenceReason}
                  onSetReason={setSessionAbsenceReason.bind(null, s.id)}
                />
              )}
            </ParentTaskCard>
            <SessionQuestionnaireTeaser firstName={player.firstName} feedback={fb} />
          </div>
        );
      })}

      {weekendConvocation ? (
        <ParentTaskCard
          kicker={fmtDay(weekend)}
          title={`${weekendConvocation.match.team.code} — ${weekendConvocation.match.competition}`}
          detail={`${weekendConvocation.match.isHome ? "Saint-Sébastien FC" : (weekendConvocation.match.opponent ?? "Adversaire")} vs ${
            weekendConvocation.match.isHome ? (weekendConvocation.match.opponent ?? "Adversaire") : "Saint-Sébastien FC"
          }${weekendConvocation.match.time ? ` · Coup d'envoi ${weekendConvocation.match.time}` : ""}`}
        >
          <Link href="/parent/planning" className="text-[13.5px] font-bold text-blue">
            Voir ma convocation →
          </Link>
        </ParentTaskCard>
      ) : (
        <ParentTaskCard kicker={fmtDay(weekend)} title="Disponibilité du samedi" detail="Ton enfant est-il disponible pour jouer ce week-end ?">
          {isBeforeOpen ? (
            <div className="text-[13px] text-[#8A8D93] italic">Réponse pas encore possible.</div>
          ) : (
            <AvailabilityChoice
              status={weekendAnswer?.status as "AVAILABLE" | "UNAVAILABLE" | undefined}
              onSetStatus={setWeekendAvailability.bind(null, weekStartIso)}
              presentLabel="Disponible"
              absentLabel="Indisponible"
              locked={isLocked}
              reasons={REASONS}
              currentReason={weekendAnswer?.absenceReason}
              onSetReason={setWeekendAbsenceReason.bind(null, weekStartIso)}
            />
          )}
        </ParentTaskCard>
      )}

      {playerTasks.map((s) => {
        const fb = feedbackBySession.get(s.id);
        const pre = isPreOpen(s) && !fb?.preAnsweredAt;
        return (
          <QuestionnaireCard
            key={`q-${s.id}`}
            firstName={player.firstName}
            question={pre ? "Comment tu te sens aujourd'hui ?" : "Comment s'est passée la séance ?"}
            moment={pre ? "Avant la séance" : "Après la séance"}
            seconds={pre ? 20 : 30}
            href={`/parent/questionnaire/${s.id}/${pre ? "pre" : "post"}`}
          />
        );
      })}

      {announcementsPreview.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between mt-1">
            <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3]">Informations du staff</div>
            <Link href="/parent/infos" className="flex items-center gap-0.5 text-[12.5px] font-bold text-green">
              Tout voir <ChevronRightIcon size={14} />
            </Link>
          </div>
          {announcementsPreview.map((a) => (
            <ParentCard key={a.id}>
              <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">
                {ANNOUNCEMENT_CATEGORY_LABELS[a.category as keyof typeof ANNOUNCEMENT_CATEGORY_LABELS] ?? a.category}
              </div>
              <div className="text-[14.5px] font-bold mt-1">{a.title}</div>
              <div className="text-[13px] text-[#6E7178] mt-0.5 line-clamp-2">{a.body}</div>
            </ParentCard>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionQuestionnaireTeaser({
  firstName,
  feedback,
}: {
  firstName: string;
  feedback?: SessionFeedback;
}) {
  const preDone = !!feedback?.preAnsweredAt;
  const postDone = !!feedback?.postAnsweredAt;
  if (!postDone && !preDone) return null;
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-green pl-1">
      <CheckIcon size={13} />
      {postDone ? `${firstName} a donné son retour après la séance` : `${firstName} a répondu avant la séance`}
    </div>
  );
}

function weekEndLabel(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${end.getDate()} ${MONTHS[end.getMonth()]}`;
}
