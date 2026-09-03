import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAlertGroups, getDataChecks } from "@/lib/alerts";
import { Section } from "@/components/ui/Section";
import { StatTile } from "@/components/ui/StatTile";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateLong, formatDayShort } from "@/lib/format";
import { requireUser, scopedTeamIdsInCategory } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { getClub } from "@/lib/club";

const ALERT_HEAD_TONE: Record<string, string> = {
  red: "bg-red-bg text-red",
  orange: "bg-orange-bg text-orange",
  green: "bg-green-bg text-green",
  blue: "bg-blue-bg text-blue",
};
const ALERT_DOT_TONE: Record<string, string> = {
  red: "bg-red",
  orange: "bg-orange",
  green: "bg-green",
  blue: "bg-blue",
};
const ALERT_TAG_TONE: Record<string, string> = {
  red: "text-red bg-red-bg",
  orange: "text-orange bg-orange-bg",
  green: "text-green bg-green-bg",
  blue: "text-blue bg-blue-bg",
};

export default async function CockpitPage() {
  const user = await requireUser();
  const activeGroup = await getActiveCategoryGroup(user);
  const activeCategories = activeGroup?.categories ?? null;
  const allTeams = await prisma.team.findMany({ select: { id: true, code: true, category: true } });
  const categoryTeamIds = scopedTeamIdsInCategory(user, allTeams, activeCategories);
  const teamFilter = { teamId: { in: categoryTeamIds } };

  const [playerCount, alertGroups, dataChecks, club] = await Promise.all([
    prisma.player.count({ where: { archived: false, ...teamFilter } }),
    getAlertGroups(categoryTeamIds),
    getDataChecks(categoryTeamIds),
    getClub(),
  ]);
  const teamCount = categoryTeamIds.length;
  const clubUnconfigured = user.role === "ADMIN" && club.name === "Mon club" && !club.hasLogo;

  const upcomingMatches = await prisma.match.findMany({
    where: { status: "Planifié", ...teamFilter },
    include: { team: true, convocations: true },
    orderBy: { date: "asc" },
  });
  const matchDay = upcomingMatches[0]?.date ?? new Date();
  const completeConvocs = upcomingMatches.filter((m) => m.opponent && m.convocations.length >= m.needed).length;

  const allNextSessions = await prisma.trainingSession.findMany({
    where: { status: "Prévue" },
    include: { scopeTeam: true },
    orderBy: { date: "asc" },
  });
  const nextSessions = allNextSessions
    .filter((s) => (s.scopeTeamId ? categoryTeamIds.includes(s.scopeTeamId) : (activeCategories ?? []).includes(s.category)))
    .slice(0, 4);
  const sessionExpected = await Promise.all(
    nextSessions.map((s) =>
      prisma.player.count({
        where: s.scopeTeamId ? { teamId: s.scopeTeamId } : { team: { category: s.category } },
      })
    )
  );

  const unavailablePlayers = await prisma.player.findMany({
    where: { status: { not: "Actif" }, archived: false, ...teamFilter },
    include: { team: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 4,
  });
  const unavailableCount = await prisma.player.count({
    where: { status: { not: "Actif" }, archived: false, ...teamFilter },
  });

  const urgentCount = alertGroups.find((g) => g.key === "urgent")?.items.filter((i) => !i.treated).length ?? 0;
  const totalActions = alertGroups
    .filter((g) => g.key === "urgent" || g.key === "traiter")
    .reduce((n, g) => n + g.items.filter((i) => !i.treated).length, 0);

  // ADMIN-only: a cross-team scan a single-team coach doesn't need, since
  // their own Cockpit already *is* their one team. Scoped to categoryTeamIds
  // like the rest of this page — an ADMIN who is also RESPONSABLE of a
  // single category (e.g. U12/U13) and has that category active must never
  // see other categories' teams (U8/U9…) sneak back in through this block,
  // which used to query every team in the club unconditionally.
  const clubOverview =
    user.role === "ADMIN"
      ? await (async () => {
          const teams = await prisma.team.findMany({
            where: { id: { in: categoryTeamIds } },
            include: { matches: { where: { status: "Planifié" }, orderBy: { date: "asc" }, take: 1 } },
            orderBy: { code: "asc" },
          });
          const openAlertsByTeam = new Map<string, number>();
          for (const g of alertGroups) {
            for (const a of g.items) {
              if (a.treated) continue;
              openAlertsByTeam.set(a.tag, (openAlertsByTeam.get(a.tag) ?? 0) + 1);
            }
          }
          return teams.map((t) => ({
            code: t.code,
            id: t.id,
            nextMatch: t.matches[0] ?? null,
            openAlerts: openAlertsByTeam.get(t.code) ?? 0,
          }));
        })()
      : null;

  return (
    <div className="max-w-[1560px] mx-auto animate-fadein">
      {clubUnconfigured && (
        <div className="flex items-center gap-3 mb-3.5 px-3.5 h-11 rounded-lg border border-club-primary/25 bg-club-primary-bg text-[12.5px]">
          <span className="flex-1">
            <span className="font-semibold">Identité du club pas encore configurée.</span> Ajoute le nom, le logo et les couleurs du club pour
            personnaliser le Cockpit, l&apos;Espace Coach et l&apos;Espace Parents.
          </span>
          <Link href="/parametres" className="shrink-0 text-club-primary font-semibold hover:underline">
            Configurer →
          </Link>
        </div>
      )}
      <div className="flex items-end justify-between gap-5 mb-[18px] flex-wrap">
        <div>
          <div className="text-2xl font-bold tracking-[-0.02em]">Bonjour {user.name.split(" ")[0]}</div>
          <div className="text-muted mt-1 text-[13.5px]">
            {formatDateLong(matchDay)} · {upcomingMatches.length} matchs · {completeConvocs}/{upcomingMatches.length} convocations
            terminées · {totalActions} action{totalActions === 1 ? "" : "s"} prioritaire{totalActions === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex gap-2">
          <StatTile value={String(playerCount)} label="Joueurs" />
          <StatTile value={String(teamCount)} label="Équipes" />
          <StatTile value={`${completeConvocs}/${upcomingMatches.length}`} label="Convocations" />
          <StatTile value={String(urgentCount)} label="Urgences" />
        </div>
      </div>

      {clubOverview && (
        <section className="bg-surface border border-line rounded-lg overflow-hidden mb-3.5">
          <div className="flex items-center gap-2 px-3.5 py-[9px] border-b border-line-soft">
            <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Vue d&apos;ensemble du club</span>
            <span className="flex-1" />
            <Link href="/equipes" className="text-blue text-xs font-semibold hover:underline">
              Toutes les équipes
            </Link>
          </div>
          <div className="flex flex-wrap">
            {clubOverview.map((t) => (
              <Link key={t.id} href={`/equipes/${t.id}`} className="flex-1 min-w-[150px] px-3 py-2.5 border-r border-b border-line-soft-2 hover:bg-bg/60">
                <div className="flex items-center gap-1.5">
                  <TeamChip code={t.code} />
                  {t.openAlerts > 0 && (
                    <span className="font-mono text-[10.5px] font-bold text-red">{t.openAlerts}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted mt-1.5 truncate">
                  {t.nextMatch ? `vs ${t.nextMatch.opponent ?? "?"} · ${formatDayShort(t.nextMatch.date)}` : "Aucun match prévu"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-3.5">
          {alertGroups.length === 0 && (
            <Section>
              <div className="px-4 py-6 text-center text-muted text-[13px]">
                Aucune alerte active — tout est sous contrôle.
              </div>
            </Section>
          )}
          {alertGroups.map((g) => {
            const openItems = g.items.filter((i) => !i.treated);
            if (!openItems.length) return null;
            return (
              <section key={g.key} className="bg-surface border border-line rounded-lg overflow-hidden">
                <div className={`flex items-center gap-2 px-3.5 py-[9px] ${ALERT_HEAD_TONE[g.tone]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ALERT_DOT_TONE[g.tone]}`} />
                  <span className="text-[11px] font-bold tracking-[0.11em] uppercase">{g.title}</span>
                  <span className="font-mono text-[11px] opacity-75">{openItems.length}</span>
                  <span className="flex-1" />
                  <span className="text-[11.5px] opacity-75">{g.hint}</span>
                </div>
                {openItems.map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center gap-3.5 px-3.5 py-[11px] border-t border-line-soft-2 hover:bg-bg/60"
                  >
                    <div
                      className={`flex items-center justify-center w-11 h-[22px] rounded font-mono text-[10px] font-bold ${ALERT_TAG_TONE[g.tone]}`}
                    >
                      {a.tag}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px]">{a.title}</div>
                      <div className="text-muted text-xs mt-0.5">{a.detail}</div>
                    </div>
                    <div className="font-mono text-[11px] text-muted-2 whitespace-nowrap">{a.meta}</div>
                    <Link
                      href={a.href}
                      className="h-7 px-[11px] border border-line bg-surface rounded-md text-xs font-semibold whitespace-nowrap flex items-center hover:border-ink hover:bg-bg"
                    >
                      {a.action}
                    </Link>
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <div className="flex flex-col gap-3.5">
          <section className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-[11px] border-b border-line-soft">
              <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">
                {formatDayShort(matchDay) === "SAM" ? "Samedi" : formatDayShort(matchDay)} — {upcomingMatches.length} matchs
              </span>
              <span className="flex-1" />
              <Link href="/matchs" className="text-blue text-xs font-semibold hover:underline">
                Tout voir
              </Link>
            </div>
            {upcomingMatches.map((m) => (
              <Link
                key={m.id}
                href={`/matchs/${m.id}`}
                className="flex items-center gap-[11px] px-3.5 py-[10px] border-b border-line-soft-2 last:border-b-0 hover:bg-bg/60"
              >
                <TeamChip code={m.team.code} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{m.opponent ?? "Adversaire à définir"}</div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    {m.opponent ? `${m.isHome ? "Domicile" : "Extérieur"} · ${m.time} · ${m.location}` : "Aucune information saisie"}
                  </div>
                </div>
                <div className="w-[92px]">
                  <div className="flex justify-between font-mono text-[10.5px] text-muted mb-[3px]">
                    <span>
                      {m.convocations.length}/{m.needed}
                    </span>
                  </div>
                  <div className="h-1 bg-line-soft rounded-full overflow-hidden">
                    <div
                      className={`h-full ${m.convocations.length === 0 ? "bg-red" : m.convocations.length < m.needed ? "bg-orange" : "bg-green"}`}
                      style={{ width: `${Math.round((100 * m.convocations.length) / m.needed)}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </section>

          <Section
            title="Prochaines séances"
            right={
              <Link href="/planning" className="text-blue text-xs font-semibold hover:underline ml-2">
                Planning
              </Link>
            }
          >
            {nextSessions.map((s, i) => (
              <Link
                key={s.id}
                href="/planning"
                className="flex items-center gap-3 px-3.5 py-[10px] border-b border-line-soft-2 last:border-b-0 hover:bg-bg/60"
              >
                <div className="w-[46px] text-center">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-muted-2">{formatDayShort(s.date)}</div>
                  <div className="font-mono text-[15px] font-bold">{String(s.date.getDate()).padStart(2, "0")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold">
                    {s.scopeTeam ? s.scopeTeam.code : s.category} — {s.label}
                  </div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    {s.startTime} › {s.endTime} · {s.location}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px] font-bold">{sessionExpected[i]}</div>
                  <div className="text-[10px] text-muted-2 uppercase tracking-[0.06em]">attendus</div>
                </div>
              </Link>
            ))}
          </Section>

          <Section
            title="Indisponibles"
            right={
              <>
                <span className="font-mono text-[11px] text-red font-bold ml-2">{unavailableCount}</span>
                <Link href="/joueurs" className="text-blue text-xs font-semibold hover:underline ml-2">
                  Voir
                </Link>
              </>
            }
          >
            <div className="px-3.5 py-[10px] flex flex-col gap-2">
              {unavailablePlayers.map((p) => (
                <Link key={p.id} href={`/joueurs/${p.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                  <Avatar initials={`${p.firstName[0]}${p.lastName[0]}`} size={24} tone="red" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-[11.5px] text-muted">
                      {p.team.category} · {p.status}
                    </div>
                  </div>
                </Link>
              ))}
              {unavailablePlayers.length === 0 && (
                <div className="text-[12.5px] text-muted-2 py-1">Aucun joueur indisponible.</div>
              )}
            </div>
          </Section>

          <Section title="Qualité des données" right={<span className="font-mono text-[11px] text-muted ml-2">{dataChecks.filter((c) => !c.ok).length} anomalies</span>} bodyClassName="px-3.5 py-3">
            <div className="flex flex-col gap-[7px]">
              {dataChecks.map((c) => (
                <div key={c.label} className="flex items-center gap-[9px] text-[12.5px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.ok ? "bg-green" : c.value > 1 ? "bg-red" : "bg-orange"}`} />
                  <span className="flex-1 text-ink-soft">{c.label}</span>
                  <span className={`font-mono text-[11.5px] font-bold ${c.ok ? "text-green" : c.value > 1 ? "text-red" : "text-orange"}`}>
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
