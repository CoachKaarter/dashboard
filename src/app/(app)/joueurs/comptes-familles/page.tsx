import { redirect } from "next/navigation";
import { requireUser, getAccessibleCategories, canManageCategory } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { FamilyAccessPanel } from "./FamilyAccessPanel";
import { updateParentContact } from "@/app/(app)/joueurs/[id]/actions";
import { computeFamilyAccessStatus, FAMILY_ACCESS_STATUS_LABEL, type FamilyAccessStatus } from "@/lib/parent-invitation-status";

export default async function ComptesFamillesPage() {
  const user = await requireUser();

  // §38 : un ADMIN voit tout, un Responsable de catégorie(s) seulement son
  // périmètre — un Coach simple sans responsabilité RESPONSABLE n'a accès à
  // rien ici (ne peut pas préparer/envoyer des accès famille).
  const manageableCategories = user.role === "ADMIN" ? null : getAccessibleCategories(user).filter((c) => canManageCategory(user, c));
  if (manageableCategories !== null && manageableCategories.length === 0) redirect("/joueurs");

  const players = await prisma.player.findMany({
    where: {
      archived: false,
      ...(manageableCategories !== null ? { team: { category: { in: manageableCategories } } } : {}),
    },
    include: {
      team: true,
      parentAccount: { select: { id: true, active: true } },
      parentInvitations: { where: { revokedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ team: { code: "asc" } }, { lastName: "asc" }],
  });

  const rows = players.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    teamCode: p.team.code,
    email: p.parentEmail,
    status: computeFamilyAccessStatus({
      parentEmail: p.parentEmail,
      account: p.parentAccount ? { active: p.parentAccount.active } : null,
      latestInvitation: p.parentInvitations[0] ?? null,
    }),
  }));

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { missing_email: 0, ready: 0, sent: 0, expired: 0, activated: 0, disabled: 0 } as Record<FamilyAccessStatus, number>
  );

  const missingEmail = players.filter((p) => !p.parentEmail);

  return (
    <div className="max-w-[900px] mx-auto animate-fadein flex flex-col gap-4">
      <div>
        <div className="text-xl font-bold tracking-[-0.01em]">Accès familles</div>
        <div className="text-muted text-[13px] mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>{rows.length} joueurs</span>
          <span>·</span>
          <span>{counts.activated} {FAMILY_ACCESS_STATUS_LABEL.activated.toLowerCase()}</span>
          <span>·</span>
          <span>{counts.ready} à envoyer</span>
          <span>·</span>
          <span>{counts.sent} envoyée{counts.sent === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>{counts.expired} expirée{counts.expired === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>{counts.missing_email} email manquant{counts.missing_email === 1 ? "" : "s"}</span>
          {counts.disabled > 0 && (
            <>
              <span>·</span>
              <span>{counts.disabled} désactivé{counts.disabled === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>

      <FamilyAccessPanel rows={rows} />

      {missingEmail.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-3.5 h-[38px] flex items-center gap-2 bg-[#FAFAF8] border-b border-line">
            <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Email parent manquant</span>
            <span className="text-[11px] text-muted-2">({missingEmail.length})</span>
          </div>
          <div className="px-3.5 py-2 flex items-center justify-between border-b border-line-soft-2">
            <span className="text-[12px] text-muted">Renseigne l&apos;email pour que ces joueurs rejoignent l&apos;envoi en masse ci-dessus.</span>
            <a
              href="/api/export/comptes-familles-manquants"
              className="h-7 px-2.5 border border-line rounded-md text-[11px] font-semibold text-ink-soft hover:border-ink shrink-0"
            >
              Exporter en CSV
            </a>
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
