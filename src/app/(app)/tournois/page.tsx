import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { FilterChip } from "@/components/ui/FilterChip";
import { formatDateShort } from "@/lib/format";
import { toQueryString } from "@/lib/query";
import { requireResponsableOrAdmin, canManageCategory } from "@/lib/authz";
import { STATUS_LABEL, STATUS_TONE, isDeadlineSoon, isDeadlinePassed } from "@/lib/tournament-invitation";
import { createInvitation, decideInvitation, reopenInvitation, createMatchFromInvitation, deleteInvitation } from "./actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg w-full";

const STATUS_FILTERS = ["Toutes", "EN_ATTENTE", "ACCEPTEE", "REFUSEE"] as const;
const STATUS_FILTER_LABEL: Record<string, string> = { Toutes: "Toutes", EN_ATTENTE: "À traiter", ACCEPTEE: "Acceptées", REFUSEE: "Refusées" };

export default async function TournoisPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireResponsableOrAdmin();
  const sp = await searchParams;
  const statusFilter = STATUS_FILTERS.includes(sp.status as (typeof STATUS_FILTERS)[number]) ? sp.status! : "Toutes";
  const isAdmin = user.role === "ADMIN";
  const now = new Date();

  const [invitations, allTeams] = await Promise.all([
    prisma.tournamentInvitation.findMany({
      where: statusFilter === "Toutes" ? {} : { status: statusFilter },
      include: { matches: { select: { id: true, teamId: true } } },
      orderBy: [{ status: "asc" }, { date: "asc" }],
    }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);

  const allCategories = [...new Set(allTeams.map((t) => t.category))].sort();
  const manageableCategories = isAdmin ? allCategories : allCategories.filter((c) => canManageCategory(user, c));

  return (
    <div className="max-w-[1100px] mx-auto animate-fadein flex flex-col gap-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <FilterChip key={s} href={toQueryString({ status: s === "Toutes" ? undefined : s })} active={statusFilter === s}>
            {STATUS_FILTER_LABEL[s]}
          </FilterChip>
        ))}
        <span className="flex-1" />
        <div className="font-mono text-[11.5px] text-muted">{invitations.length} invitation{invitations.length > 1 ? "s" : ""}</div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {invitations.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucune invitation pour ces filtres.</div>}
        {invitations.map((inv) => {
          const canDecide = isAdmin || inv.categories.some((c) => canManageCategory(user, c));
          const deadlineSoon = inv.status === "EN_ATTENTE" && isDeadlineSoon(inv.responseDeadline, now);
          const deadlinePassed = inv.status === "EN_ATTENTE" && isDeadlinePassed(inv.responseDeadline, now);
          const teamsInScope = allTeams.filter(
            (t) => inv.categories.includes(t.category) && (isAdmin || canManageCategory(user, t.category))
          );
          const matchByTeamId = new Map(inv.matches.map((m) => [m.teamId, m.id]));

          return (
            <div key={inv.id} className="border-b border-line-soft-2 last:border-b-0 px-3.5 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[13.5px] font-bold">{inv.organizingClub}</span>
                {inv.categories.map((c) => (
                  <TeamChip key={c} code={c} />
                ))}
                <span className="font-mono text-[12px] text-muted">{formatDateShort(inv.date)}</span>
                {inv.location && <span className="text-[12px] text-muted-2">· {inv.location}</span>}
                <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                {inv.responseDeadline && (
                  <span className={`text-[11.5px] ${deadlinePassed ? "text-red font-semibold" : deadlineSoon ? "text-orange font-semibold" : "text-muted-2"}`}>
                    {deadlinePassed ? "Réponse attendue avant le" : "Répondre avant le"} {formatDateShort(inv.responseDeadline)}
                  </span>
                )}
                <span className="flex-1" />
                {inv.status === "EN_ATTENTE" && canDecide && (
                  <div className="flex items-center gap-1.5">
                    <form action={decideInvitation.bind(null, inv.id, "ACCEPTEE")}>
                      <button type="submit" className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-green bg-green-bg text-green hover:brightness-95">
                        Accepter
                      </button>
                    </form>
                    <form action={decideInvitation.bind(null, inv.id, "REFUSEE")}>
                      <button type="submit" className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-line text-muted hover:border-red hover:text-red">
                        Refuser
                      </button>
                    </form>
                  </div>
                )}
                {inv.status !== "EN_ATTENTE" && canDecide && (
                  <form action={reopenInvitation.bind(null, inv.id)}>
                    <button type="submit" className="h-7 px-2.5 rounded-md text-[11px] font-semibold text-muted hover:text-ink hover:underline">
                      Rouvrir
                    </button>
                  </form>
                )}
              </div>

              {inv.practicalInfo && (
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-muted hover:text-ink select-none">Infos pratiques</summary>
                  <div className="mt-1 text-ink-soft whitespace-pre-wrap">{inv.practicalInfo}</div>
                </details>
              )}

              {inv.status === "ACCEPTEE" && teamsInScope.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-line-soft">
                  {teamsInScope.map((t) => {
                    const matchId = matchByTeamId.get(t.id);
                    return matchId ? (
                      <a key={t.id} href={`/matchs/${matchId}`} className="text-[12px] font-semibold text-blue hover:underline">
                        {t.code} — Voir le match →
                      </a>
                    ) : (
                      <form key={t.id} action={createMatchFromInvitation.bind(null, inv.id, t.id)}>
                        <button type="submit" className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-line text-ink-soft hover:border-ink hover:text-ink">
                          Créer le match {t.code}
                        </button>
                      </form>
                    );
                  })}
                </div>
              )}

              {isAdmin && inv.matches.length === 0 && (
                <form action={deleteInvitation.bind(null, inv.id)} className="self-start">
                  <button type="submit" className="text-[11px] font-semibold text-red hover:underline">
                    Supprimer cette invitation
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-line rounded-lg p-3.5">
        <div className="text-[12.5px] font-bold mb-2.5">Nouvelle invitation</div>
        {manageableCategories.length === 0 ? (
          <div className="text-[12.5px] text-muted-2">Aucune catégorie dont vous êtes Responsable — seul un Responsable peut enregistrer une invitation.</div>
        ) : (
          <form action={createInvitation} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <input name="organizingClub" required placeholder="Club organisateur" className={inputClass} />
              <input type="date" name="date" required className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input name="location" placeholder="Lieu (optionnel)" className={inputClass} />
              <input type="date" name="responseDeadline" className={inputClass} title="Date limite de réponse (optionnel)" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11.5px] font-semibold text-muted">Catégories visées :</span>
              {manageableCategories.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-[12.5px]">
                  <input type="checkbox" name="categories" value={c} className="w-3.5 h-3.5" />
                  {c}
                </label>
              ))}
            </div>
            <textarea
              name="practicalInfo"
              placeholder="Infos pratiques (frais d'engagement, format, contact — optionnel)"
              rows={2}
              className={`${inputClass} h-auto py-2 resize-none`}
            />
            <button type="submit" className="self-start h-9 px-3.5 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Enregistrer l&apos;invitation
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
