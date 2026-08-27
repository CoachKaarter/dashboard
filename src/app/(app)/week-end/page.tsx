import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIdsInCategory, canManageCategory, getAccessibleCategories } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { getWeekStart, addDays } from "@/lib/availability";
import { getWeekendBoard } from "@/lib/weekend";
import { getClubMessageTemplates } from "@/lib/club";
import { DEFAULT_CONVOCATION_MESSAGE_TEMPLATE, renderMessageTemplate } from "@/lib/message-templates";
import { toQueryString } from "@/lib/query";
import { Badge } from "@/components/ui/Badge";
import { WeekendBoard } from "@/components/WeekendBoard";
import { SubmitButton } from "@/components/SubmitButton";
import { ConvocationCopyAndPoster } from "@/components/ConvocationCopyAndPoster";
import { fetchConvocationPosterData } from "@/lib/convocation-poster-data";
import { validateWeekendPlan, reopenWeekendPlan, generateWeekendConvocations } from "./actions";
import { computeParentInfoCompleteness } from "@/lib/match-parent-info";
import { TRANSPORT_MODE_LABELS } from "@/lib/equipment";

export default async function WeekEndPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const activeGroup = await getActiveCategoryGroup(user);

  const baseWeek = sp.week ? getWeekStart(new Date(sp.week)) : getWeekStart(new Date());
  const weekStartIso = baseWeek.toISOString();

  const [allTeams, staffUsers, hdrs, clubTemplates] = await Promise.all([
    prisma.team.findMany({ select: { id: true, code: true, category: true } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    headers(),
    getClubMessageTemplates(),
  ]);
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const parentUrl = `${proto}://${host}/parent`;
  const CLUB_SITE_URL = "https://ssfc.fr/";
  const scope = scopedTeamIdsInCategory(user, allTeams, activeGroup?.categories ?? null);
  const board = await getWeekendBoard(baseWeek, scope);
  const { plan, weekendDate, teamCards, unassignedAvailable, assignedButUnavailable, counts } = board;

  const status = plan?.status ?? "DRAFT";
  const editable = status !== "PUBLISHED";

  const teamCardsForBoard = teamCards.map((c) => ({
    team: { id: c.team.id, code: c.team.code, category: c.team.category },
    match: c.match ? { id: c.match.id, opponent: c.match.opponent, time: c.match.time, isHome: c.match.isHome, location: c.match.location } : null,
    nextMatch:
      c.nextMatch && c.nextMatch.id !== c.match?.id
        ? { id: c.nextMatch.id, opponent: c.nextMatch.opponent, date: c.nextMatch.date.toISOString(), time: c.nextMatch.time, isHome: c.nextMatch.isHome }
        : null,
    assigned: c.assigned.map((a) => ({
      player: {
        id: a.player.id,
        firstName: a.player.firstName,
        lastName: a.player.lastName,
        position: a.player.position,
        positionAlt: a.player.positionAlt,
        foot: a.player.foot,
        teamCode: a.player.team.code,
      },
    })),
    keeper: c.keeper
      ? {
          player: {
            id: c.keeper.player.id,
            firstName: c.keeper.player.firstName,
            lastName: c.keeper.player.lastName,
            position: c.keeper.player.position,
            positionAlt: c.keeper.player.positionAlt,
            foot: c.keeper.player.foot,
            teamCode: c.keeper.player.team.code,
          },
        }
      : null,
    staff: c.staff.map((s) => ({ id: s.id, role: s.role, user: { name: s.user.name } })),
    needed: c.needed,
    canManageCategory: canManageCategory(user, c.team.category),
  }));

  const unassignedForBoard = unassignedAvailable.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    positionAlt: p.positionAlt,
    foot: p.foot,
    teamCode: p.team.code,
  }));

  // Checklist d'anomalies avant validation — certaines sont "assumables" (le
  // staff les voit, les confirme d'un clic implicite en validant quand même),
  // aucune ne bloque techniquement la validation.
  const anomalies: { tone: "red" | "orange"; text: string }[] = [];
  for (const c of teamCards) {
    if (c.assigned.length > 0 && !c.keeper) anomalies.push({ tone: "red", text: `${c.team.code} : aucun gardien affecté` });
    if (c.assigned.length > 0 && c.assigned.length < c.needed) anomalies.push({ tone: "orange", text: `${c.team.code} : sous-effectif (${c.assigned.length} / ${c.needed})` });
    if (c.assigned.length > 0 && c.staff.length === 0) anomalies.push({ tone: "orange", text: `${c.team.code} : aucun encadrant affecté` });
    if (!c.match) anomalies.push({ tone: "orange", text: `${c.team.code} : aucun match renseigné pour ce week-end` });
  }
  if (unassignedAvailable.length > 0) anomalies.push({ tone: "orange", text: `${unassignedAvailable.length} joueur(s) disponible(s) non affecté(s)` });
  for (const a of assignedButUnavailable) {
    anomalies.push({ tone: "red", text: `${a.player.firstName} ${a.player.lastName} affecté alors qu'il/elle s'est déclaré(e) indisponible` });
  }

  // Mirrors assertCanManageWeekend() server-side (src/app/(app)/week-end/actions.ts):
  // WeekendPlan is one global row per weekend, so acting on it requires
  // Responsable-level coverage of every category actually assigned that
  // weekend — or, for a still-empty plan, at least one managed category.
  const involvedCategories = [...new Set(teamCards.filter((c) => c.assigned.length > 0).map((c) => c.team.category))];
  const canManageThisWeekend =
    involvedCategories.length > 0
      ? involvedCategories.every((c) => canManageCategory(user, c))
      : getAccessibleCategories(user).some((c) => canManageCategory(user, c));

  const dateLabel = `${weekendDate.getDate()} ${MONTH_LABEL(weekendDate)}`;
  const convocationsMessage = renderMessageTemplate(clubTemplates.convocationMessageTemplate ?? DEFAULT_CONVOCATION_MESSAGE_TEMPLATE, {
    date: dateLabel,
    lien_parent: parentUrl,
    lien_club: CLUB_SITE_URL,
  });
  // Le visuel de convocation réutilise le même board que le message
  // ci-dessus — jamais une deuxième requête indépendante — et n'est
  // construit que quand le bouton peut réellement apparaître (convocations
  // publiées), pour ne pas alourdir cette page le reste du temps.
  const posterData = status === "PUBLISHED" ? await fetchConvocationPosterData(board) : null;
  const posterFileDateLabel = `${String(weekendDate.getDate()).padStart(2, "0")}-${String(weekendDate.getMonth() + 1).padStart(2, "0")}-${weekendDate.getFullYear()}`;

  return (
    <div className="max-w-[1400px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg px-4 py-3.5 flex items-center gap-3 flex-wrap mb-3.5">
        <div>
          <div className="text-[15px] font-bold">Week-end du {dateLabel}</div>
          <div className="text-[11.5px] text-muted mt-0.5">
            Parents → Disponibilités → Répartition → Validation → Convocations
          </div>
        </div>
        <span className="flex-1" />
        {status === "DRAFT" && <Badge tone="orange">Brouillon</Badge>}
        {status === "VALIDATED" && <Badge tone="blue">Validé</Badge>}
        {status === "PUBLISHED" && <Badge tone="green">Convocations publiées</Badge>}
        {status === "PUBLISHED" && posterData && (
          <ConvocationCopyAndPoster
            message={convocationsMessage}
            data={posterData}
            fileDateLabel={posterFileDateLabel}
            triggerClassName="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink"
          />
        )}
        <a
          href={toQueryString({ week: addDays(baseWeek, -7).toISOString().slice(0, 10) })}
          className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink flex items-center transition-all duration-100 active:scale-95"
        >
          ← Semaine précédente
        </a>
        <a
          href={toQueryString({ week: addDays(baseWeek, 7).toISOString().slice(0, 10) })}
          className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink flex items-center transition-all duration-100 active:scale-95"
        >
          Semaine suivante →
        </a>

        {/* Validation/publication is a global, one-row-per-weekend action
            (see assertCanManageWeekend, src/app/(app)/week-end/actions.ts) —
            it requires Responsable-level coverage of every category
            involved this weekend, not the ADMIN technical role; hidden here
            for anyone else so the UI doesn't offer a button that would just
            bounce them server-side. */}
        {canManageThisWeekend && status === "DRAFT" && (
          <form action={validateWeekendPlan.bind(null, weekStartIso)}>
            <SubmitButton pendingLabel="Validation…" className="h-9 px-3.5 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Valider le plan
            </SubmitButton>
          </form>
        )}
        {canManageThisWeekend && status === "VALIDATED" && (
          <>
            <form action={reopenWeekendPlan.bind(null, weekStartIso)}>
              <SubmitButton className="h-9 px-3.5 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
                Rouvrir
              </SubmitButton>
            </form>
            <form action={generateWeekendConvocations.bind(null, weekStartIso)}>
              <SubmitButton pendingLabel="Génération…" className="h-9 px-3.5 rounded-md bg-green text-white text-[12.5px] font-semibold hover:opacity-90">
                Générer les convocations
              </SubmitButton>
            </form>
          </>
        )}
        {canManageThisWeekend && status === "PUBLISHED" && (
          <form action={reopenWeekendPlan.bind(null, weekStartIso)}>
            <SubmitButton className="h-9 px-3.5 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
              Rouvrir (des convocations sont déjà publiées)
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="flex gap-2 mb-3.5 flex-wrap">
        {[
          ["Joueurs", counts.totalPlayers],
          ["Disponibles", counts.available],
          ["Indisponibles", counts.unavailable],
          ["Sans réponse", counts.noResponse],
          ["Matchs confirmés", `${counts.matchesConfirmed} / ${counts.matchesTotal}`],
          ["Places nécessaires", counts.placesNeeded],
          ["Affectés", counts.assigned],
          ["Disponibles non affectés", counts.unassigned],
        ].map(([label, val]) => (
          <div key={label as string} className="px-3 py-1.5 bg-surface border border-line rounded-md transition-colors duration-200">
            <span className="font-mono text-[15px] font-bold mr-1.5 transition-colors duration-200">{val}</span>
            <span className="text-[11px] text-muted">{label}</span>
          </div>
        ))}
      </div>

      {anomalies.length > 0 && (
        <div className="bg-surface border border-line rounded-lg px-3.5 py-2.5 mb-3.5 animate-slidedown">
          <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-1.5">
            Points à vérifier avant validation ({anomalies.length})
          </div>
          <ul className="flex flex-col gap-1">
            {anomalies.map((a, i) => (
              <li key={i} className={`text-[12px] animate-fadein ${a.tone === "red" ? "text-red" : "text-orange"}`}>
                {a.tone === "red" ? "🔴" : "⚠"} {a.text}
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-muted-2 mt-1.5">
            Ces points n&apos;empêchent pas la validation — vérifiez-les puis validez en connaissance de cause.
          </div>
        </div>
      )}

      {status === "VALIDATED" && (
        <div className="bg-surface border border-line rounded-lg px-3.5 py-2.5 mb-3.5 animate-slidedown">
          <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-1.5">
            Infos transmises aux familles à la publication
          </div>
          <div className="flex flex-col gap-2">
            {teamCards
              .filter((c) => c.assigned.length > 0 && c.match)
              .map((c) => {
                const m = c.match!;
                const completeness = computeParentInfoCompleteness(m);
                const rows: [string, string | null][] = [
                  ["RDV", m.meetTime],
                  ["Coup d'envoi", m.time],
                  ["Lieu", m.location ?? m.venueAddress],
                  ["Transport", m.transportMode ? TRANSPORT_MODE_LABELS[m.transportMode as keyof typeof TRANSPORT_MODE_LABELS] : null],
                  ["Tenue", m.dressCode],
                ];
                return (
                  <div key={c.team.id} className="flex items-start gap-3 pb-2 border-b border-line-soft-2 last:border-b-0 last:pb-0">
                    <div className="w-14 shrink-0 text-[12.5px] font-bold pt-0.5">{c.team.code}</div>
                    <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {rows
                        .filter(([, v]) => v)
                        .map(([label, v]) => (
                          <span key={label} className="text-[12px]">
                            <span className="text-muted-2">{label} :</span> <span className="font-semibold">{v}</span>
                          </span>
                        ))}
                      {rows.every(([, v]) => !v) && <span className="text-[12px] text-red">Aucune info pratique renseignée</span>}
                    </div>
                    <span
                      className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        color: completeness.percent === 100 ? "#3F8F5B" : completeness.percent >= 50 ? "#B08A3E" : "#B4451E",
                        background: completeness.percent === 100 ? "#EEF7EF" : completeness.percent >= 50 ? "#FBF3E4" : "#FBEDE7",
                      }}
                    >
                      {completeness.percent}%
                    </span>
                  </div>
                );
              })}
          </div>
          <div className="text-[11px] text-muted-2 mt-2">
            Modifiable jusqu&apos;à la publication sur la fiche de chaque match — n&apos;empêche pas de générer les convocations.
          </div>
        </div>
      )}

      <WeekendBoard
        weekStartIso={weekStartIso}
        teamCards={teamCardsForBoard}
        unassigned={unassignedForBoard}
        staffUsers={staffUsers}
        editable={editable}
      />
    </div>
  );
}

function MONTH_LABEL(d: Date) {
  return ["jan.", "fév.", "mar.", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."][d.getMonth()];
}
