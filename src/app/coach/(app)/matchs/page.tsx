import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { parisStartOfDay } from "@/lib/timezone";
import { FlagIcon } from "@/components/coach/icons";
import { computeMatchPhase } from "@/lib/match-phase";
import { FORMATIONS } from "@/lib/constants";

const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export default async function CoachMatchsPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const teamWhere = scope === "ALL" ? {} : { teamId: { in: scope } };
  const today = parisStartOfDay(new Date());

  const [upcoming, recent] = await Promise.all([
    prisma.match.findMany({
      where: { ...teamWhere, date: { gte: today }, status: { not: "Annulé" } },
      include: { team: true, convocations: true, slots: true },
      orderBy: { date: "asc" },
      take: 10,
    }),
    prisma.match.findMany({
      where: { ...teamWhere, date: { lt: today } },
      include: { team: true, convocations: true, slots: true },
      orderBy: { date: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <div className="text-[22px] font-bold tracking-[-0.01em]">Matchs</div>

      {upcoming.length === 0 && recent.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-6 text-center text-[14px] text-[#6E7178]">
          Aucun match dans ton périmètre.
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">Prochains matchs</div>
          {upcoming.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-2">Matchs récents</div>
          {recent.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </>
      )}
    </div>
  );
}

function MatchCard({
  m,
}: {
  m: {
    id: string;
    opponent: string | null;
    date: Date;
    time: string | null;
    location: string | null;
    isHome: boolean;
    team: { code: string };
    convocations: { confirmed: boolean | null }[];
    slots: { id: string }[];
    status: string;
    formation: string;
    collectiveNote: string | null;
    objectiveStatus: string | null;
  };
}) {
  const confirmed = m.convocations.filter((c) => c.confirmed === true).length;
  const phase = computeMatchPhase({
    status: m.status,
    convocationCount: m.convocations.length,
    startersCount: m.slots.length,
    neededStarters: (FORMATIONS[m.formation] ?? FORMATIONS["1-3-3-1"]).length,
    bilanFilled: !!(m.collectiveNote || m.objectiveStatus),
  });
  return (
    <Link
      href={`/coach/matchs/${m.id}`}
      className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex items-center gap-3 active:bg-[#FAFAF8] transition-colors duration-100"
    >
      <div className="w-11 text-center shrink-0">
        <div className="text-[10px] uppercase text-[#9A9DA3]">{DAY_NAMES[m.date.getDay()]}</div>
        <div className="text-[18px] font-bold">{m.date.getDate()}</div>
        <div className="text-[9.5px] text-[#9A9DA3]">{MONTHS[m.date.getMonth()]}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-[11px] font-bold tracking-[0.06em] uppercase text-green">{m.team.code}</div>
          {phase === "JOUE" && <span className="text-[10px] font-semibold text-orange">· Bilan à compléter</span>}
        </div>
        <div className="text-[14.5px] font-bold truncate">{m.opponent ?? "Adversaire à définir"}</div>
        <div className="text-[12.5px] text-[#6E7178] mt-0.5">
          {[m.time, m.isHome ? "domicile" : "extérieur", m.location].filter(Boolean).join(" · ")}
        </div>
        <div className="text-[12px] text-[#9A9DA3] mt-0.5 flex items-center gap-1">
          <FlagIcon size={12} />
          {m.convocations.length} convoqué{m.convocations.length > 1 ? "s" : ""}
          {confirmed > 0 ? ` · ${confirmed} confirmé${confirmed > 1 ? "s" : ""}` : ""}
        </div>
      </div>
    </Link>
  );
}
