import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { requireUser, canAccessSession } from "@/lib/authz";
import {
  setAttendance,
  setAttendanceNote,
  markAllPresent,
  resetPresence,
  updateSession,
  cancelSession,
  deleteSession,
  terminerSeance,
} from "../actions";
import { SessionBlocksSection } from "./SessionBlocksSection";

const CODES: { code: string; label: string }[] = [
  { code: "P", label: "Présent" },
  { code: "R", label: "Retard" },
  { code: "AJ", label: "Absent justifié" },
  { code: "ANJ", label: "Absent non justifié" },
  { code: "B", label: "Blessé" },
];
const CODE_TONE: Record<string, string> = { P: "#3F8F5B", R: "#C97A17", AJ: "#6E7178", ANJ: "#C4362C", B: "#C4362C" };

export default async function SeanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await prisma.trainingSession.findUnique({ where: { id }, include: { scopeTeam: true } });
  if (!session) notFound();
  if (!(await canAccessSession(user, session))) notFound();

  const [players, blocks] = await Promise.all([
    prisma.player.findMany({
      where: session.scopeTeamId ? { teamId: session.scopeTeamId } : { team: { category: session.category } },
      include: { team: true, attendances: { where: { sessionId: id } } },
      orderBy: { lastName: "asc" },
    }),
    prisma.sessionBlock.findMany({ where: { sessionId: id }, orderBy: { order: "asc" } }),
  ]);

  const counts: Record<string, number> = { P: 0, R: 0, AJ: 0, ANJ: 0, B: 0 };
  let pointed = 0;
  for (const p of players) {
    const code = p.attendances[0]?.code;
    if (code) {
      counts[code]++;
      pointed++;
    }
  }
  const label = session.scopeTeam ? session.scopeTeam.code : session.category;
  const dayLabel = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][session.date.getDay()];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFuture = session.date > today;
  const previsionnel = isFuture && pointed > 0;

  return (
    <div className="max-w-[1200px] mx-auto animate-fadein">
      <Link href="/seances" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Toutes les séances
      </Link>

      <div className="bg-surface border border-line rounded-lg px-[18px] py-4 flex items-center gap-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="text-[19px] font-bold tracking-[-0.01em]">
              {label} — {dayLabel} {session.date.getDate()}
            </div>
            <Badge
              tone={
                session.status === "Réalisée"
                  ? "green"
                  : session.status === "Annulée"
                    ? "red"
                    : session.status === "En cours"
                      ? "orange"
                      : "blue"
              }
            >
              {session.status}
            </Badge>
          </div>
          <div className="text-muted text-[12.5px] mt-1">
            {session.startTime} › {session.endTime} · {session.location} · {players.length} joueurs attendus
          </div>
          {(session.theme || session.objective) && (
            <div className="text-[12.5px] mt-1.5 flex items-center gap-3 flex-wrap">
              {session.theme && (
                <span><span className="text-muted-2">Thème :</span> <span className="font-semibold">{session.theme}</span></span>
              )}
              {session.objective && (
                <span><span className="text-muted-2">Objectif :</span> <span className="font-semibold">{session.objective}</span></span>
              )}
            </div>
          )}
        </div>
        <div className="flex-1" />
        {session.status !== "Réalisée" && session.status !== "Annulée" && (
          <form action={terminerSeance.bind(null, id)}>
            <button
              type="submit"
              className="h-8 px-3 border border-green bg-green-bg text-green rounded-md text-xs font-semibold cursor-pointer hover:brightness-95"
            >
              Terminer la séance
            </button>
          </form>
        )}
        <div className="flex gap-5 flex-wrap">
          {[
            ["Présents", counts.P, "text-green"],
            ["Retards", counts.R, "text-orange"],
            ["Absents justifiés", counts.AJ, "text-muted"],
            ["Absents non justifiés", counts.ANJ, "text-red"],
            ["Blessés", counts.B, "text-red"],
            ["Non pointés", players.length - pointed, "text-muted-2"],
          ].map(([lbl, val, cls]) => (
            <div key={lbl as string} className="text-right">
              <div className={`font-mono text-[19px] font-bold ${cls}`}>{val}</div>
              <div className="text-[10px] text-muted uppercase tracking-[0.06em] mt-px whitespace-nowrap">{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <details className="bg-surface border border-line rounded-lg mt-3.5">
        <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold text-muted hover:text-ink select-none">
          Modifier / annuler la séance
        </summary>
        <div className="px-3.5 pb-3.5 flex flex-col gap-2.5">
          <form action={updateSession.bind(null, id)} className="grid grid-cols-2 gap-2.5">
            <input name="label" defaultValue={session.label} className={detailInputClass} />
            <input name="location" defaultValue={session.location} className={detailInputClass} />
            <input type="date" name="date" defaultValue={session.date.toISOString().slice(0, 10)} className={detailInputClass} />
            <div className="flex gap-2">
              <input type="time" name="startTime" defaultValue={session.startTime} className={detailInputClass} />
              <input type="time" name="endTime" defaultValue={session.endTime} className={detailInputClass} />
            </div>
            <input name="theme" defaultValue={session.theme ?? ""} placeholder="Thème (ex. Conservation du ballon)" className={detailInputClass} />
            <input name="objective" defaultValue={session.objective ?? ""} placeholder="Objectif pédagogique" className={detailInputClass} />
            <button type="submit" className="col-span-2 h-9 border-none rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Enregistrer les modifications
            </button>
          </form>
          <div className="flex gap-2.5 pt-2 border-t border-line-soft">
            {session.status !== "Annulée" && (
              <form action={cancelSession.bind(null, id)}>
                <button type="submit" className="h-9 px-3 border border-line rounded-md text-xs font-semibold text-orange hover:border-orange">
                  Annuler la séance
                </button>
              </form>
            )}
            <form action={deleteSession.bind(null, id)}>
              <button type="submit" className="h-9 px-3 border border-line rounded-md text-xs font-semibold text-red hover:border-red">
                Supprimer définitivement
              </button>
            </form>
          </div>
        </div>
      </details>

      <SessionBlocksSection sessionId={id} blocks={blocks} />

      {previsionnel && (
        <div className="mt-3.5 px-3.5 py-2.5 rounded-lg border border-blue/30 bg-blue-bg text-blue text-[12.5px] font-medium">
          Présence prévisionnelle — cette séance n&apos;a pas encore eu lieu, ce pointage reflète ce qui est déjà su à
          l&apos;avance (absences prévenues…). Il ne passera en « Réalisée » qu&apos;à partir du jour de la séance.
        </div>
      )}

      <div className="flex items-center gap-2.5 my-3.5">
        <form action={markAllPresent.bind(null, id)}>
          <button
            type="submit"
            className="h-[30px] px-3 border border-green bg-green-bg text-green rounded-md text-xs font-semibold cursor-pointer hover:brightness-95"
          >
            Tout marquer présent
          </button>
        </form>
        <form action={resetPresence.bind(null, id)}>
          <button
            type="submit"
            className="h-[30px] px-3 border border-line bg-surface rounded-md text-xs font-semibold cursor-pointer text-muted hover:border-ink hover:text-ink"
          >
            Réinitialiser
          </button>
        </form>
        <span className="flex-1" />
        <div className="flex items-center gap-2.5">
          <div className="w-40 h-1 bg-line-soft rounded-full overflow-hidden">
            <div className="h-full bg-green" style={{ width: `${Math.round((100 * pointed) / Math.max(1, players.length))}%` }} />
          </div>
          <div className="font-mono text-[11.5px] text-muted">
            {pointed} / {players.length} pointés
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className="grid grid-cols-[minmax(190px,1fr)_76px_140px_300px_180px] gap-3 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
          <div>Joueur</div>
          <div>Équipe</div>
          <div>Poste</div>
          <div>Pointage</div>
          <div>Motif</div>
        </div>
        {players.map((p) => {
          const current = p.attendances[0]?.code;
          const note = p.attendances[0]?.note ?? "";
          return (
            <div
              key={p.id}
              className={`grid grid-cols-[minmax(190px,1fr)_76px_140px_300px_180px] gap-3 items-center px-3.5 h-11 border-b border-line-soft-2 last:border-b-0 ${
                current ? "bg-[#FCFCFB]" : "bg-surface"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar initials={`${p.firstName[0]}${p.lastName[0]}`} size={26} />
                <div className="text-[12.5px] font-semibold truncate">
                  {p.firstName} {p.lastName}
                </div>
              </div>
              <div>
                <TeamChip code={p.team.code} />
              </div>
              <div className="text-[12.5px] text-ink-soft">{p.position}</div>
              <div className="flex gap-[5px]">
                {CODES.map(({ code, label: codeLabel }) => {
                  const on = current === code;
                  return (
                    <form key={code} action={setAttendance.bind(null, id, p.id, code)}>
                      <button
                        type="submit"
                        title={codeLabel}
                        className="flex-1 h-10 sm:h-7 rounded-[5px] font-mono text-[11px] font-bold border cursor-pointer w-[52px] min-w-[44px] sm:min-w-0"
                        style={{
                          borderColor: on ? CODE_TONE[code] : "#E3E3DE",
                          background: on ? CODE_TONE[code] : "#FFFFFF",
                          color: on ? "#FFFFFF" : "#6E7178",
                        }}
                      >
                        {code}
                      </button>
                    </form>
                  );
                })}
              </div>
              <form action={setAttendanceNote.bind(null, id, p.id)} className="flex gap-1">
                <input
                  name="note"
                  defaultValue={note}
                  placeholder="—"
                  className="h-7 flex-1 min-w-0 border border-line rounded-md px-2 text-[11.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                />
                <button type="submit" className="h-7 px-2 border border-line rounded-md text-[10.5px] font-semibold text-muted hover:border-ink hover:text-ink">
                  OK
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const detailInputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";
