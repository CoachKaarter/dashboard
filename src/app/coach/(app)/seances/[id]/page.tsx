import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { parisDateAtTime } from "@/lib/timezone";
import { computeDelayMinutes } from "@/lib/attendance-delay";
import { setAttendance, setAttendanceNote, markAllPresent, addExceptionalExpectation } from "@/app/(app)/seances/actions";
import { ensureSessionExpectations } from "@/lib/session-expectation";
import { AttendanceBoard, type BoardPlayer } from "@/components/coach/AttendanceBoard";
import { AddExceptionalPlayer } from "@/components/coach/AddExceptionalPlayer";
import { ArrowLeftIcon } from "@/components/coach/icons";
import { SeanceTab } from "./SeanceTab";
import { FinTab } from "./FinTab";

const TABS = [
  { key: "pointage", label: "Pointage" },
  { key: "seance", label: "Séance" },
  { key: "fin", label: "Fin" },
];

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function CoachSeanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "pointage";

  const user = await requireUser();
  const session = await prisma.trainingSession.findUnique({ where: { id }, include: { scopeTeam: true } });
  if (!session || session.deletedAt) notFound();
  if (!(await canAccessSession(user, session))) notFound();

  await ensureSessionExpectations(id);

  const [expectations, categoryPlayers, availabilities, blocks] = await Promise.all([
    prisma.sessionExpectation.findMany({
      where: { sessionId: id },
      include: { player: { include: { attendances: { where: { sessionId: id } } } } },
      orderBy: { player: { lastName: "asc" } },
    }),
    prisma.player.findMany({
      where: { archived: false, team: { category: session.category } },
      include: { team: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.playerAvailability.findMany({ where: { sessionId: id, type: "TRAINING" } }),
    prisma.sessionBlock.findMany({ where: { sessionId: id }, orderBy: { order: "asc" } }),
  ]);

  // L'appel ne porte que sur les joueurs ATTENDUS (§23/§25) — un joueur
  // finalement présent mais non prévu passe par "+ Ajouter un joueur non
  // prévu" ci-dessous, qui le rend ATTENDU pour cette séance uniquement.
  const players = expectations.filter((e) => e.expected).map((e) => e.player);
  const allExpectationPlayerIds = new Set(expectations.map((e) => e.playerId));
  const exceptionalCandidates = categoryPlayers
    .filter((p) => !allExpectationPlayerIds.has(p.id))
    .map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, teamCode: p.team.code }));

  const availByPlayer = new Map(availabilities.map((a) => [a.playerId, a]));
  const [sh, sm] = session.startTime.split(":").map(Number);
  const plannedStart = parisDateAtTime(session.date, sh, sm);

  const boardPlayers: BoardPlayer[] = players.map((p) => {
    const att = p.attendances[0];
    const delayMinutes = att?.code === "R" && att.arrivalTime ? computeDelayMinutes(att.arrivalTime, plannedStart) : null;
    const avail = availByPlayer.get(p.id);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      code: att?.code ?? null,
      note: att?.note ?? null,
      delayMinutes,
      familyStatus: (avail?.status as "AVAILABLE" | "UNAVAILABLE" | undefined) ?? null,
      familyReason: avail?.absenceReason ?? null,
    };
  });

  const teamLabel = session.scopeTeam ? session.scopeTeam.code : session.category;
  const dayLabel = DAY_NAMES[session.date.getDay()];

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <Link href="/coach/seances" className="inline-flex items-center gap-1 text-[#8A8D93] text-[13px] font-medium -ml-0.5">
        <ArrowLeftIcon size={15} /> Séances
      </Link>

      <div>
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-green">{teamLabel}</div>
        <div className="text-[20px] font-bold tracking-[-0.01em] mt-0.5 capitalize">
          {dayLabel} {session.date.getDate()} {MONTHS[session.date.getMonth()]}
        </div>
        <div className="text-[13.5px] text-[#6E7178] mt-0.5">
          {session.startTime} — {session.endTime} · {session.location}
        </div>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-[#E7E7E2] p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/coach/seances/${id}?tab=${t.key}`}
            className={`flex-1 h-10 rounded-lg text-[13.5px] font-bold flex items-center justify-center transition-colors duration-150 ${
              tab === t.key ? "bg-ink text-white" : "text-[#6E7178]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "pointage" && (
        <div className="flex flex-col gap-3.5">
          <AttendanceBoard
            players={boardPlayers}
            onSetAttendance={setAttendance.bind(null, id)}
            onSetNote={setAttendanceNote.bind(null, id)}
            onMarkAllPresent={markAllPresent.bind(null, id)}
          />
          <AddExceptionalPlayer candidates={exceptionalCandidates} onAdd={addExceptionalExpectation.bind(null, id)} />
        </div>
      )}
      {tab === "seance" && <SeanceTab session={session} blocks={blocks} playerCount={players.length} />}
      {tab === "fin" && <FinTab sessionId={id} session={session} players={boardPlayers} blocks={blocks} />}
    </div>
  );
}
