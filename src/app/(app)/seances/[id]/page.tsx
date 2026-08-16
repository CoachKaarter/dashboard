import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { setAttendance, markAllPresent, resetPresence } from "../actions";

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
  const session = await prisma.trainingSession.findUnique({ where: { id }, include: { scopeTeam: true } });
  if (!session) notFound();

  const players = await prisma.player.findMany({
    where: session.scopeTeamId ? { teamId: session.scopeTeamId } : { team: { category: session.category } },
    include: { team: true, attendances: { where: { sessionId: id } } },
    orderBy: { lastName: "asc" },
  });

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
            <Badge tone={session.status === "Réalisée" ? "green" : "blue"}>{session.status}</Badge>
          </div>
          <div className="text-muted text-[12.5px] mt-1">
            {session.startTime} › {session.endTime} · {session.location} · {players.length} joueurs attendus
          </div>
        </div>
        <div className="flex-1" />
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
        <div className="grid grid-cols-[minmax(190px,1fr)_76px_140px_300px] gap-3 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
          <div>Joueur</div>
          <div>Équipe</div>
          <div>Poste</div>
          <div>Pointage</div>
        </div>
        {players.map((p) => {
          const current = p.attendances[0]?.code;
          return (
            <div
              key={p.id}
              className={`grid grid-cols-[minmax(190px,1fr)_76px_140px_300px] gap-3 items-center px-3.5 h-11 border-b border-line-soft-2 last:border-b-0 ${
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
                        className="flex-1 h-7 rounded-[5px] font-mono text-[11px] font-bold border cursor-pointer w-[52px]"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
