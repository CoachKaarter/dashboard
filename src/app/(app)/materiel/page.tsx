import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@/lib/format";
import { requireUser, teamScopeWhere, scopedTeamIds } from "@/lib/authz";
import { createJersey, markReturned, updateCondition, deleteJersey } from "./actions";

const GRID = "grid-cols-[84px_76px_minmax(160px,1fr)_110px_110px_120px_90px_140px]";
const CONDITION_TONE: Record<string, "green" | "orange" | "red"> = { Bon: "green", "À laver": "orange", Abîmé: "red" };
const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function MaterielPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const [jerseys, allTeams, allPlayers] = await Promise.all([
    prisma.jersey.findMany({ where: teamScopeWhere(user), include: { team: true, player: true }, orderBy: { issuedDate: "desc" } }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
    prisma.player.findMany({ where: { archived: false }, orderBy: { lastName: "asc" } }),
  ]);
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));
  const now = new Date();

  return (
    <div className="max-w-[1500px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg overflow-auto mb-4">
        <div className={`grid ${GRID} gap-3 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div>Sac</div>
          <div>Équipe</div>
          <div>Responsable</div>
          <div>Retour prévu</div>
          <div>Retour réel</div>
          <div>État</div>
          <div>Retard</div>
          <div />
        </div>
        {jerseys.map((j) => {
          const retard = !j.returnedDate && j.dueDate < now ? Math.round((now.getTime() - j.dueDate.getTime()) / 86400000) : 0;
          return (
            <div key={j.id} className={`grid ${GRID} gap-3 px-3.5 h-[46px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px]`}>
              <div className="font-mono text-muted">{j.code}</div>
              <div>
                <TeamChip code={j.team.code} />
              </div>
              <div className="font-semibold truncate">{j.responsible}</div>
              <div className="font-mono">{formatDateShort(j.dueDate)}</div>
              <div className={`font-mono ${j.returnedDate ? "" : "text-red"}`}>{j.returnedDate ? formatDateShort(j.returnedDate) : "—"}</div>
              <form action={updateCondition.bind(null, j.id)} className="flex gap-1">
                <select
                  name="condition"
                  defaultValue={j.condition}
                  className="h-7 border border-line rounded-md px-1.5 text-[11px] bg-surface outline-none"
                >
                  <option value="Bon">Bon</option>
                  <option value="À laver">À laver</option>
                  <option value="Abîmé">Abîmé</option>
                </select>
                <button type="submit" className="h-7 px-1.5 border border-line rounded-md text-[10px] font-semibold text-muted hover:border-ink hover:text-ink">
                  OK
                </button>
              </form>
              <div>{retard > 0 ? <Badge tone="red">{retard} j.</Badge> : <Badge tone={CONDITION_TONE[j.condition] ?? "neutral"}>{j.condition}</Badge>}</div>
              <div className="flex gap-1.5 justify-end">
                {!j.returnedDate && (
                  <form action={markReturned.bind(null, j.id)}>
                    <button type="submit" className="h-7 px-2 border border-line rounded-md text-[10.5px] font-semibold text-green hover:border-green">
                      Retourné
                    </button>
                  </form>
                )}
                <form action={deleteJersey.bind(null, j.id)}>
                  <button type="submit" className="h-7 px-2 border border-line rounded-md text-[10.5px] font-semibold text-red hover:border-red">
                    Suppr.
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {jerseys.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun sac enregistré.</div>}
      </div>

      <div className="bg-surface border border-line rounded-lg p-3.5">
        <div className="text-[12.5px] font-bold mb-2.5">Nouveau sac / attribution</div>
        <form action={createJersey} className="grid grid-cols-4 gap-2.5">
          <input name="code" required placeholder="Code (ex. SAC021)" className={inputClass} />
          <select name="teamId" required defaultValue="" className={inputClass}>
            <option value="" disabled>Équipe</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.code}</option>
            ))}
          </select>
          <select name="playerId" defaultValue="" className={inputClass}>
            <option value="">Aucun joueur</option>
            {allPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </select>
          <input name="responsible" required placeholder="Responsable (ex. Famille Dupont)" className={inputClass} />
          <button type="submit" className="col-span-4 h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
            Attribuer
          </button>
        </form>
      </div>
    </div>
  );
}
