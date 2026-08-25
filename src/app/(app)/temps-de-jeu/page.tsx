import { prisma } from "@/lib/prisma";
import { getAllPlayerStats } from "@/lib/stats";
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

const PERIODS = [
  { key: "saison", label: "Saison" },
  { key: "30j", label: "30 derniers jours" },
  { key: "5m", label: "5 derniers matchs" },
];

export default async function TempsDeJeuPage({ searchParams }: { searchParams: Promise<{ team?: string; periode?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));
  const availableCategories = [...new Set(teams.map((t) => t.category))].sort();
  if (availableCategories.length === 0) {
    return <div className="max-w-[1620px] mx-auto animate-fadein text-muted text-[13px]">Aucune équipe autorisée pour votre compte.</div>;
  }
  const categoryOptions = ["Toutes", ...availableCategories];
  // Defaults to a specific category rather than "Toutes" — a player floats
  // between the teams of ONE category (V5.2 équipe fluide), but U12 and
  // U13 minutes aren't comparable to each other, so a focused view is the
  // sane default; "Toutes" stays a click away for anyone who wants it.
  const category = categoryOptions.includes(sp.team ?? "") ? sp.team! : availableCategories[0];
  const periode = PERIODS.some((p) => p.key === sp.periode) ? sp.periode! : "saison";

  const allStats = await getAllPlayerStats();
  const players = allStats.filter(
    (p) => (scope === "ALL" || scope.includes(p.teamId)) && (category === "Toutes" || p.category === category)
  );
  const settings = await getSettings();

  // Pooled across every team of the category (or every scoped team for
  // "Toutes") — a player can appear in any of these matches regardless of
  // which team they're nominally on, so the match list can't be scoped to
  // a single team's fixtures anymore.
  const matchWhere = {
    status: "Joué",
    ...(scope === "ALL" ? {} : { teamId: { in: scope } }),
    ...(category === "Toutes" ? {} : { team: { category } }),
  };
  const recentMatchesForCalc = await prisma.match.findMany({
    where: matchWhere,
    orderBy: { date: "desc" },
    take: 30,
    include: { team: true, stats: true },
  });
  const recentMatches = recentMatchesForCalc.slice(0, 5);
  const matchCols = recentMatches.slice().reverse();

  const cutoff30j = new Date();
  cutoff30j.setDate(cutoff30j.getDate() - 30);

  function periodMinutes(playerId: string, seasonTotal: number) {
    if (periode === "5m") return matchCols.reduce((s, m) => s + (m.stats.find((st) => st.playerId === playerId)?.minutes ?? 0), 0);
    if (periode === "30j")
      return recentMatchesForCalc
        .filter((m) => m.date >= cutoff30j)
        .reduce((s, m) => s + (m.stats.find((st) => st.playerId === playerId)?.minutes ?? 0), 0);
    return seasonTotal;
  }

  const withPeriodMinutes = players.map((p) => ({ p, periodMin: periodMinutes(p.id, p.minutes) }));
  const teamAvg = withPeriodMinutes.length ? Math.round(withPeriodMinutes.reduce((s, x) => s + x.periodMin, 0) / withPeriodMinutes.length) : 0;
  const minutesList = withPeriodMinutes.map((x) => x.periodMin);
  const ecartMax = minutesList.length ? Math.max(...minutesList) - Math.min(...minutesList) : 0;
  const sousLeSeuil = withPeriodMinutes.filter((x) => x.periodMin - teamAvg < -settings.ecartTdj).length;

  const rows = withPeriodMinutes
    .slice()
    .sort((a, b) => a.periodMin - b.periodMin)
    .map(({ p, periodMin }, i) => {
      const cells = matchCols.map((m) => {
        const stat = m.stats.find((s) => s.playerId === p.id);
        const mins = stat?.minutes ?? 0;
        const tone = minuteTone(mins);
        const c = MINUTE_COLORS[tone];
        return { value: mins === 0 ? "—" : String(mins), fg: c.fg, bg: c.bg };
      });
      const ecart = periodMin - teamAvg;
      return { rank: i + 1, p, cells, ecart, periodMin };
    });

  return (
    <div className="max-w-[1620px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        {categoryOptions.map((c) => (
          <FilterChip key={c} href={toQueryString({ team: c === availableCategories[0] ? undefined : c, periode: sp.periode })} active={category === c}>
            {c}
          </FilterChip>
        ))}
        <div className="w-px h-[22px] bg-line mx-1" />
        {PERIODS.map((p) => (
          <FilterChip key={p.key} href={toQueryString({ team: category, periode: p.key === "saison" ? undefined : p.key })} active={periode === p.key}>
            {p.label}
          </FilterChip>
        ))}
      </div>
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <span className="flex-1" />
        {[
          [category === "Toutes" ? "Moyenne" : "Moyenne catégorie", `${teamAvg}'`],
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
            <div key={m.id} className="text-center leading-tight">
              <div>{formatDateShort(m.date)}</div>
              <div className="text-[9px] font-normal normal-case text-muted-2">{m.team.code}</div>
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
            <div className="text-right font-mono font-bold">{r.periodMin}</div>
            <div className="text-right font-mono text-muted">{r.p.matchsJoues ? Math.round(r.periodMin / r.p.matchsJoues) : 0}</div>
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
