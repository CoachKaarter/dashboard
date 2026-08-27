import { requireAdmin, teamScopeWhere } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { BulkAccountCreationPanel } from "./BulkAccountCreationPanel";
import { updateParentContact } from "@/app/(app)/joueurs/[id]/actions";

export default async function ComptesFamillesPage() {
  const user = await requireAdmin();

  const players = await prisma.player.findMany({
    where: { archived: false, ...teamScopeWhere(user) },
    include: { team: true, parentAccount: { select: { id: true } } },
    orderBy: [{ team: { code: "asc" } }, { lastName: "asc" }],
  });

  const withAccount = players.filter((p) => p.parentAccount);
  const withoutAccount = players.filter((p) => !p.parentAccount);
  const eligible = withoutAccount.filter((p) => p.parentEmail);
  const missingEmail = withoutAccount.filter((p) => !p.parentEmail);

  return (
    <div className="max-w-[900px] mx-auto animate-fadein flex flex-col gap-4">
      <div>
        <div className="text-xl font-bold tracking-[-0.01em]">Comptes familles</div>
        <div className="text-muted text-[13px] mt-1">
          {withAccount.length} compte{withAccount.length === 1 ? "" : "s"} déjà créé{withAccount.length === 1 ? "" : "s"} ·{" "}
          {eligible.length} en attente (email renseigné) · {missingEmail.length} sans email renseigné.
        </div>
      </div>

      <BulkAccountCreationPanel
        players={eligible.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.parentEmail! }))}
      />

      {missingEmail.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-3.5 h-[38px] flex items-center gap-2 bg-[#FAFAF8] border-b border-line">
            <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Email parent manquant</span>
            <span className="text-[11px] text-muted-2">({missingEmail.length})</span>
          </div>
          <div className="px-3.5 py-2 text-[12px] text-muted border-b border-line-soft-2">
            Renseigne l&apos;email pour que ces joueurs rejoignent la création en masse ci-dessus.
          </div>
          {missingEmail.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0">
              <TeamChip code={p.team.code} />
              <div className="flex-1 min-w-0 text-[12.5px] font-semibold truncate">
                {p.firstName} {p.lastName}
              </div>
              <form action={updateParentContact.bind(null, p.id)} className="flex gap-1.5 shrink-0">
                {/* updateParentContact écrit les 3 champs à chaque appel — on renvoie
                    nom/téléphone existants tels quels pour ne pas les effacer, seul
                    l'email change ici. */}
                <input type="hidden" name="parentName" value={p.parentName ?? ""} />
                <input type="hidden" name="parentPhone" value={p.parentPhone ?? ""} />
                <input
                  type="email"
                  name="parentEmail"
                  required
                  placeholder="email@parent.fr"
                  className="h-8 w-[210px] border border-line rounded-md px-2.5 text-[12px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                />
                <button type="submit" className="h-8 px-2.5 border border-line rounded-md text-[11px] font-semibold text-ink-soft hover:border-ink">
                  Enregistrer
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
