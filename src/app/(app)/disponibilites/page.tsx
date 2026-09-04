import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, getAccessibleCategories } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { getWeekStart, addDays, getWindowForWeek } from "@/lib/availability";
import { getClubMessageTemplates } from "@/lib/club";
import { DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, renderMessageTemplate } from "@/lib/message-templates";
import { getWeekendResults } from "@/lib/weekend-results";
import { TeamChip } from "@/components/ui/TeamChip";
import { FilterChip } from "@/components/ui/FilterChip";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/CopyButton";
import { toQueryString } from "@/lib/query";
import { openWindow, closeWindow, reopenWindow, setAvailabilityByStaff } from "./actions";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default async function DisponibilitesPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; team?: string; missing?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const accessibleCategories = getAccessibleCategories(user).sort();
  const activeGroup = await getActiveCategoryGroup(user);
  const selectedKey = sp.team ?? activeGroup?.categories[0] ?? "Tous";
  const selectedCategory = accessibleCategories.includes(selectedKey) ? selectedKey : null;
  const selectedTeamCode = !selectedCategory && selectedKey !== "Tous" ? selectedKey : null;

  const baseWeek = sp.week ? getWeekStart(new Date(sp.week)) : getWeekStart(new Date());
  const weekStartIso = baseWeek.toISOString();
  const weekEndExclusive = addDays(baseWeek, 7);
  const weekend = addDays(baseWeek, 5);
  const previousWeekStart = addDays(baseWeek, -7);

  const [window, allTeams, sessionsAll, hdrs, clubTemplates] = await Promise.all([
    getWindowForWeek(baseWeek),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
    prisma.trainingSession.findMany({
      where: { date: { gte: baseWeek, lt: weekEndExclusive }, status: { not: "Annulée" } },
      include: { scopeTeam: true },
      orderBy: { date: "asc" },
    }),
    headers(),
    getClubMessageTemplates(),
  ]);
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const parentUrl = `${proto}://${host}/parent`;
  const teams = (scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id))).filter(
    (t) => !activeGroup || activeGroup.categories.includes(t.category)
  );
  // Same permission scope + active category the rest of this page already
  // uses for its own roster (teams above) — never the raw, unfiltered
  // club-wide list. The range is the week BEFORE the one shown on screen
  // (baseWeek), not the current calendar date: a responsable who navigates
  // to "Semaine suivante" to open next week's pointage, then copies the
  // Sunday message, expects the week they just closed out (midweek
  // friendlies included, not just Saturday) — see weekend-results.ts.
  const weekendResultLines = clubTemplates.includeWeekendResultsInAvailabilityMessage
    ? await getWeekendResults(previousWeekStart, baseWeek, teams.map((t) => t.id))
    : [];
  const sundayMessage = renderMessageTemplate(clubTemplates.availabilityMessageTemplate ?? DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, {
    date_limite: window?.closesAt ? `le ${formatDT(new Date(window.closesAt))}` : "la date limite indiquée",
    lien_parent: parentUrl,
    resultats: weekendResultLines.join("\n"),
  });

  // One column per distinct calendar date that has at least one session, plus Samedi (weekend) at the end.
  const dateKeys = [...new Set(sessionsAll.map((s) => s.date.toISOString().slice(0, 10)))].sort();
  const dayColumns = dateKeys.map((key) => ({
    key,
    date: new Date(key),
    sessions: sessionsAll.filter((s) => s.date.toISOString().slice(0, 10) === key),
  }));

  // A player with no fixed team (Player.teamId null) is still in scope
  // whenever their category is — filtering by teamId/team relation alone
  // would silently drop them, category being the actual source of truth.
  const scopeCategories = scope === "ALL" ? null : new Set(allTeams.filter((t) => scope.includes(t.id)).map((t) => t.category));
  const players = await prisma.player.findMany({
    where: {
      archived: false,
      ...(scopeCategories ? { category: { in: [...scopeCategories] } } : {}),
      ...(selectedCategory
        ? { category: selectedCategory }
        : selectedTeamCode
          ? { team: { OR: [{ code: selectedTeamCode }, { category: selectedTeamCode }] } }
          : {}),
    },
    include: { team: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const answers = await prisma.playerAvailability.findMany({ where: { weekStartDate: baseWeek } });
  const answerKey = (playerId: string, sessionId: string | null, type: string) => `${playerId}|${type}|${sessionId ?? ""}`;
  const answerByKey = new Map(answers.map((a) => [answerKey(a.playerId, a.sessionId, a.type), a]));
  const weekendAnswerByPlayer = new Map(answers.filter((a) => a.type === "WEEKEND").map((a) => [a.playerId, a]));

  function sessionFor(player: (typeof players)[number], col: (typeof dayColumns)[number]) {
    return col.sessions.find((s) => s.scopeTeamId === player.teamId) ?? col.sessions.find((s) => !s.scopeTeamId && s.category === player.category);
  }

  const rows = players.map((p) => {
    const cells = dayColumns.map((col) => {
      const session = sessionFor(p, col);
      if (!session) return { applicable: false as const };
      const a = answerByKey.get(answerKey(p.id, session.id, "TRAINING"));
      return { applicable: true as const, session, answer: a };
    });
    const weekendAnswer = weekendAnswerByPlayer.get(p.id);
    const applicableCount = cells.filter((c) => c.applicable).length + 1;
    const answeredCount = cells.filter((c) => c.applicable && "answer" in c && c.answer).length + (weekendAnswer ? 1 : 0);
    return { player: p, cells, weekendAnswer, applicableCount, answeredCount };
  });

  const complets = rows.filter((r) => r.answeredCount === r.applicableCount).length;
  const sansReponse = rows.filter((r) => r.answeredCount === 0).length;
  const incomplets = rows.length - complets - sansReponse;
  const filteredRows = sp.missing === "1" ? rows.filter((r) => r.answeredCount < r.applicableCount) : rows;

  return (
    <div className="max-w-[1400px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg px-4 py-3.5 flex items-center gap-3 flex-wrap mb-3.5">
        <div>
          <div className="text-[15px] font-bold">
            Semaine du {baseWeek.getDate()} au {addDays(baseWeek, 6).getDate()} {MONTH_LABEL(addDays(baseWeek, 6))}
          </div>
          {window?.closesAt && window.status !== "CLOSED" && (
            <div className="text-[11.5px] text-muted mt-0.5">Clôture prévue le {formatDT(new Date(window.closesAt))}</div>
          )}
        </div>
        <span className="flex-1" />
        <CopyButton
          text={sundayMessage}
          label="Copier le message du dimanche"
          className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink"
        />
        <a href={toQueryString({ week: addDays(baseWeek, -7).toISOString().slice(0, 10) })} className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink flex items-center">
          ← Semaine précédente
        </a>
        <a href={toQueryString({ week: addDays(baseWeek, 7).toISOString().slice(0, 10) })} className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink flex items-center">
          Semaine suivante →
        </a>

        {(!window || window.status === "CLOSED") && (
          <form action={openWindow.bind(null, weekStartIso)} className="flex items-center gap-2">
            <span className="text-[12.5px] text-muted">🔒 Pointage fermé</span>
            <button type="submit" className="h-9 px-3.5 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Ouvrir le pointage
            </button>
          </form>
        )}
        {window?.status === "OPEN" && (
          <>
            <Badge tone="green">🟢 Pointage ouvert</Badge>
            <form action={closeWindow.bind(null, weekStartIso)}>
              <button type="submit" className="h-9 px-3.5 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
                Clôturer
              </button>
            </form>
          </>
        )}
        {window?.status === "LOCKED" && (
          <>
            <Badge tone="orange">Clôturé</Badge>
            <form action={reopenWindow.bind(null, weekStartIso)}>
              <button type="submit" className="h-9 px-3.5 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
                Réouvrir exceptionnellement
              </button>
            </form>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 mb-3.5 flex-wrap">
        <div className="flex gap-2">
          {[["Joueurs", rows.length], ["Complets", complets], ["Incomplets", incomplets], ["Sans réponse", sansReponse]].map(([label, val]) => (
            <div key={label as string} className="px-3 py-1.5 bg-surface border border-line rounded-md">
              <span className="font-mono text-[15px] font-bold mr-1.5">{val}</span>
              <span className="text-[11px] text-muted">{label}</span>
            </div>
          ))}
        </div>
        <span className="flex-1" />
        <FilterChip href={toQueryString({ week: sp.week, team: "Tous", missing: sp.missing })} active={selectedKey === "Tous"}>
          Tous
        </FilterChip>
        {accessibleCategories.map((c) => (
          <FilterChip key={c} href={toQueryString({ week: sp.week, team: c, missing: sp.missing })} active={selectedKey === c}>
            {c}
          </FilterChip>
        ))}
        {teams.map((t) => (
          <FilterChip key={t.id} href={toQueryString({ week: sp.week, team: t.code, missing: sp.missing })} active={selectedKey === t.code} mono>
            {t.code}
          </FilterChip>
        ))}
        <FilterChip href={toQueryString({ week: sp.week, team: sp.team, missing: sp.missing === "1" ? undefined : "1" })} active={sp.missing === "1"}>
          Réponses manquantes
        </FilterChip>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div
          className="grid gap-2 px-3.5 items-center h-9 bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.07em] uppercase text-muted"
          style={{ gridTemplateColumns: `minmax(180px,1fr) repeat(${dayColumns.length + 1}, 72px)` }}
        >
          <div>Joueur</div>
          {dayColumns.map((c) => (
            <div key={c.key} className="text-center">{DAY_NAMES[c.date.getDay()]}</div>
          ))}
          <div className="text-center">Sam.</div>
        </div>
        {filteredRows.map((r) => (
          <div
            key={r.player.id}
            className="grid gap-2 px-3.5 items-center h-11 border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
            style={{ gridTemplateColumns: `minmax(180px,1fr) repeat(${dayColumns.length + 1}, 72px)` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <TeamChip code={r.player.category} />
              <span className="font-semibold truncate">{r.player.firstName} {r.player.lastName}</span>
            </div>
            {r.cells.map((c, i) =>
              c.applicable ? (
                <Cell
                  key={i}
                  status={c.answer?.status}
                  onSet={setAvailabilityByStaff.bind(null, r.player.id, "TRAINING", c.session!.id, c.session!.date.toISOString(), weekStartIso)}
                />
              ) : (
                <div key={i} className="text-center text-muted-2">—</div>
              )
            )}
            <Cell
              status={r.weekendAnswer?.status}
              onSet={setAvailabilityByStaff.bind(null, r.player.id, "WEEKEND", null, weekend.toISOString(), weekStartIso)}
            />
          </div>
        ))}
        {filteredRows.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">Aucun joueur pour ce filtre.</div>}
      </div>
    </div>
  );
}

function Cell({ status, onSet }: { status?: string; onSet: (status: "AVAILABLE" | "UNAVAILABLE") => Promise<void> }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <form action={onSet.bind(null, "AVAILABLE")}>
        <button
          type="submit"
          title="Disponible"
          className="w-6 h-6 rounded flex items-center justify-center text-[12px] font-bold"
          style={{
            background: status === "AVAILABLE" ? "#3F8F5B" : "#F1F1EE",
            color: status === "AVAILABLE" ? "#FFFFFF" : "#9A9DA3",
          }}
        >
          ✓
        </button>
      </form>
      <form action={onSet.bind(null, "UNAVAILABLE")}>
        <button
          type="submit"
          title="Indisponible"
          className="w-6 h-6 rounded flex items-center justify-center text-[12px] font-bold"
          style={{
            background: status === "UNAVAILABLE" ? "#C4362C" : "#F1F1EE",
            color: status === "UNAVAILABLE" ? "#FFFFFF" : "#9A9DA3",
          }}
        >
          ✕
        </button>
      </form>
    </div>
  );
}

function MONTH_LABEL(d: Date) {
  return ["jan.", "fév.", "mar.", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."][d.getMonth()];
}
function formatDT(d: Date) {
  return `${d.getDate()} ${MONTH_LABEL(d)} à ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}
