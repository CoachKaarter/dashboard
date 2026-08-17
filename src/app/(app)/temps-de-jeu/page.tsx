import { prisma } from "@/lib/prisma";
import { getPlayerStatsByTeam } from "@/lib/stats";
import { getSettings } from "@/lib/settings";
import { FilterChip } from "@/components/ui/FilterChip";
import { Avatar } from "@/components/ui/Avatar";
import { toQueryString } from "@/lib/query";
import { formatDateShort, minuteTone } from "@/lib/format";
import { requireUser, scopedTeamIds } from "@/lib/authz";

const MINUTE_COLORS: Record<string, { fg: string; bg: string }> = {
  none: { fg: "#9A9DA3", bg: "#F1F1EE" },
  low: { fg: "#C4362C", bg: "#FBEDEB" },
  mid: { fg: "#C97A17", bg: "#FDF3E4" },
  good: { fg: "#3F8F5B", bg: "#ECF5EF" },
  great: { fg: "#FFFFFF", bg: "#3F8F5B" },
};

export default async function TempsDeJeuPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));
  const team = teams.some((t) => t.code === sp.team) ? sp.team! : teams[0]?.code;
  if (!team) {
    return <div className="max-w-[1620px] mx-auto animate-fadein text-muted text-[13px]">Aucune équipe autorisée pour votre compte.</div>;
  }

  const [players, settings] = await Promise.all([getPlayerStatsByTeam(team), getSettings()]);

  const recentMatches = await prisma.match.findMany({
    where: { team: { code: team }, status: "Joué" },
    orderBy: { date: "desc" },
    take: 5,
    include: { stats: true },
  });
  const matchCols = recentMatches.slice().reverse();

  const teamAvg = players.length ? Math.round(players.reduce((s, p) => s + p.minutes, 0) / players.length) : 0;
  const minutesList = players.map((p) => p.minutes);
  const ecartMax = minutesList.length ? Math.max(...minutesList) - Math.min(...minutesList) : 0;
  const sousLeSeuil = players.filter((p) => p.minutes - teamAvg < -settings.ecartTdj).length;

  const rows = players
    .slice()
    .sort((a, b) => a.minutes - b.minutes)
    .map((p, i) => {
      const cells = matchCols.map((m) => {
        const stat = m.stats.find((s) => s.playerId === p.id);
        const mins = stat?.minutes ?? 0;
        const tone = minuteTone(mins);
        const c = MINUTE_COLORS[tone];
        return { value: mins === 0 ? "—" : String(mins), fg: c.fg, bg: c.bg };
      });
      const ecart = p.minutes - teamAvg;
      return { rank: i + 1, p, cells, ecart };
    });

  return (
    <div className="max-w-[1620px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {teams.map((t) => (
          <FilterChip key={t.code} href={toQueryString({ team: t.code })} active={team === t.code} mono>
            {t.code}
          </FilterChip>
        ))}
        <span className="flex-1" />
        {[
          ["Moyenne équipe", `${teamAvg}'`],
          ["Écart max", `${ecartMax}'`],
          ["Sous le seuil", String(sousLeSeuil)],
          ["À faire jouer samedi", String(Math.min(3, players.length))],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5 px-3 border-l border-line">
            <span className="font-mono text-[15px] font-bold">{value}</span>
            <span className="text-[11px] text-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div
          className="grid gap-2 px-3.5 items-center h-9 bg-[#FAFAF8] border-b border-line text-[10px] font-bold tracking-[0.07em] uppercase text-muted"
          style={{ gridTemplateColumns: `30px minmax(180px,1fr) 118px repeat(${matchCols.length || 1}, 56px) 66px 62px 66px 70px 100px` }}
        >
          <div>#</div>
          <div>Joueur</div>
          <div>Poste</div>
          {matchCols.map((m) => (
            <div key={m.id} className="text-center">
              {formatDateShort(m.date)}
            </div>
          ))}
          {matchCols.length === 0 && <div className="text-center">—</div>}
          <div className="text-right">Total</div>
          <div className="text-right">Moy.</div>
          <div className="text-right">Titu.</div>
          <div className="text-right">Écart</div>
          <div className="text-right">Tendance</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.p.id}
            className="grid gap-2 px-3.5 items-center h-11 border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
            style={{ gridTemplateColumns: `30px minmax(180px,1fr) 118px repeat(${matchCols.length || 1}, 56px) 66px 62px 66px 70px 100px` }}
          >
            <div className="font-mono text-muted-2 text-[11px]">{r.rank}</div>
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar initials={r.p.initials} size={24} />
              <div className="font-semibold truncate">{r.p.name}</div>
            </div>
            <div className="text-muted truncate">{r.p.position}</div>
            {r.cells.map((c, i) => (
              <div
                key={i}
                className="h-[26px] flex items-center justify-center rounded font-mono text-[11.5px] font-bold"
                style={{ color: c.fg, background: c.bg }}
              >
                {c.value}
              </div>
            ))}
            {r.cells.length === 0 && <div className="h-[26px] flex items-center justify-center text-muted-2">—</div>}
            <div className="text-right font-mono font-bold">{r.p.minutes}</div>
            <div className="text-right font-mono text-muted">{r.p.matchsJoues ? Math.round(r.p.minutes / r.p.matchsJoues) : 0}</div>
            <div className="text-right font-mono text-muted">
              {r.p.titularisations}/{r.p.matchsDispo}
            </div>
            <div
              className="text-right font-mono text-xs font-bold"
              style={{ color: r.ecart < -settings.ecartTdj ? "#C4362C" : r.ecart < 0 ? "#C97A17" : "#3F8F5B" }}
            >
              {r.ecart >= 0 ? "+" : ""}
              {r.ecart}
            </div>
            <div className="text-right">
              <span
                className="text-[11px] font-semibold px-[7px] py-0.5 rounded"
                style={{
                  color: r.p.trend === "décroche" ? "#C4362C" : r.p.trend === "en tête" ? "#3C6E9F" : "#6E7178",
                  background: r.p.trend === "décroche" ? "#FBEDEB" : r.p.trend === "en tête" ? "#EDF2F8" : "#F1F1EE",
                }}
              >
                {r.p.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-3 text-[11.5px] text-muted items-center flex-wrap">
        <span>Minutes par match :</span>
        {[
          ["non joué", "#F1F1EE"],
          ["moins de 20", "#FBEDEB"],
          ["20 à 34", "#FDF3E4"],
          ["35 à 54", "#ECF5EF"],
          ["55 et plus", "#3F8F5B"],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3 rounded" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
