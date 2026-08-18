import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekendDate, getWindowForWeek, getPlayerWeekSessions } from "@/lib/availability";
import { isPreOpen, isPostOpen } from "@/lib/session-feedback";
import { setSessionAvailability, setSessionAbsenceReason, setWeekendAvailability, setWeekendAbsenceReason } from "./actions";
import { ParentHeader } from "@/components/parent/ParentHeader";
import { ParentStatusBanner } from "@/components/parent/ParentStatusBanner";
import { ParentTaskCard } from "@/components/parent/ParentTaskCard";
import { AvailabilityChoice } from "@/components/parent/AvailabilityChoice";
import { QuestionnaireCard } from "@/components/parent/QuestionnaireCard";
import { CheckIcon } from "@/components/parent/icons";
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
  const weekStart = getWeekStart(today);
  const weekend = getWeekendDate(weekStart);
  const weekStartIso = weekStart.toISOString();

  const [window, { player, sessions }, answers, weekendConvocation] = await Promise.all([
    getWindowForWeek(weekStart),
    getPlayerWeekSessions(parent.playerId, weekStart),
    prisma.playerAvailability.findMany({ where: { playerId: parent.playerId, weekStartDate: weekStart } }),
    // Once le staff a publié une convocation officielle pour ce samedi, la
    // question "disponible ce week-end" n'a plus lieu d'être — la réponse
    // qui compte devient "je viens / je ne viens pas" à CE match, gérée
    // dans Planning (§18). Réutilise MatchConvocation, rien de nouveau.
    prisma.matchConvocation.findFirst({ where: { playerId: parent.playerId, match: { date: weekend } }, include: { match: { include: { team: true } } } }),
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
