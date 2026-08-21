import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { getWeekStart, addDays } from "@/lib/availability";
import { getWeekendBoard } from "@/lib/weekend";
import { toQueryString } from "@/lib/query";
import { Badge } from "@/components/ui/Badge";
import { WeekendBoard } from "@/components/WeekendBoard";
import { SubmitButton } from "@/components/SubmitButton";
import { validateWeekendPlan, reopenWeekendPlan, generateWeekendConvocations } from "./actions";

export default async function WeekEndPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);

  const baseWeek = sp.week ? getWeekStart(new Date(sp.week)) : getWeekStart(new Date());
  const weekStartIso = baseWeek.toISOString();

  const [board, staffUsers] = await Promise.all([
    getWeekendBoard(baseWeek, scope),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const { plan, weekendDate, teamCards, unassignedAvailable, assignedButUnavailable, counts } = board;

  const status = plan?.status ?? "DRAFT";
  const editable = status !== "PUBLISHED";

  const teamCardsForBoard = teamCards.map((c) => ({
    team: { id: c.team.id, code: c.team.code, category: c.team.category },
    match: c.match ? { id: c.match.id, opponent: c.match.opponent, time: c.match.time, isHome: c.match.isHome, location: c.match.location } : null,
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

  const dateLabel = `${weekendDate.getDate()} ${MONTH_LABEL(weekendDate)}`;

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

        {/* Validation/publication is a global, cross-team action (see
            src/app/(app)/week-end/actions.ts) — reserved for ADMIN there;
            hidden here for anyone else so the UI doesn't offer a button
            that would just bounce them server-side. */}
        {user.role === "ADMIN" && status === "DRAFT" && (
          <form action={validateWeekendPlan.bind(null, weekStartIso)}>
            <SubmitButton pendingLabel="Validation…" className="h-9 px-3.5 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Valider le plan
            </SubmitButton>
          </form>
        )}
        {user.role === "ADMIN" && status === "VALIDATED" && (
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
        {user.role === "ADMIN" && status === "PUBLISHED" && (
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
