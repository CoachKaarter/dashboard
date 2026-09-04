"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canManageCategory } from "@/lib/authz";
import { issueParentInvitation } from "@/lib/parent-invitation";
import { issuePasswordResetForAccount } from "@/lib/parent-password-reset";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// §38 : un Responsable de catégorie peut inviter/gérer les familles de son
// périmètre — pas seulement l'ADMIN. Chaque action re-vérifie le périmètre
// du JOUEUR concerné (pas juste "a-t-il une responsabilité quelque part"),
// server-side, avant toute écriture.
async function assertCanManageFamilyAccess(playerId: string) {
  const user = await requireUser();
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) redirect("/joueurs");
  if (user.role !== "ADMIN" && !canManageCategory(user, player.category)) redirect(`/joueurs/${playerId}`);
  return { user, player };
}

export type InviteActionResult = { ok: true; email: string } | { ok: false; error: string };

export async function sendInvitationAction(
  _prev: InviteActionResult | null,
  formData: FormData
): Promise<InviteActionResult> {
  const playerId = String(formData.get("playerId") ?? "");
  const { user } = await assertCanManageFamilyAccess(playerId);

  const result = await issueParentInvitation(playerId, user.id);
  revalidatePath(`/joueurs/${playerId}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, email: result.email };
}

export async function resendInvitationAction(playerId: string) {
  const { user } = await assertCanManageFamilyAccess(playerId);
  await issueParentInvitation(playerId, user.id);
  revalidatePath(`/joueurs/${playerId}`);
}

export async function sendPasswordResetAction(accountId: string) {
  const account = await prisma.parentAccount.findUnique({ where: { id: accountId }, include: { player: true } });
  if (!account) return;
  await assertCanManageFamilyAccess(account.playerId);
  await issuePasswordResetForAccount(accountId, null);
  revalidatePath(`/joueurs/${account.playerId}`);
}

export async function setParentAccountActive(accountId: string, active: boolean) {
  const account = await prisma.parentAccount.findUnique({ where: { id: accountId } });
  if (!account) return;
  await assertCanManageFamilyAccess(account.playerId);
  await prisma.parentAccount.update({ where: { id: accountId }, data: { active } });
  revalidatePath(`/joueurs/${account.playerId}`);
}

// Unlike deletePlayer, this is low-stakes and reversible in effect (a new
// invitation can be issued right after) — the identifiant itself just goes
// back to being available. ParentContentState cascades with it (onDelete:
// Cascade); EquipmentAssignment.parentAccountId is set null (onDelete:
// SetNull) so loan history survives the account.
export async function deleteParentAccountAction(accountId: string) {
  const existing = await prisma.parentAccount.findUnique({ where: { id: accountId } });
  if (!existing) return;
  await assertCanManageFamilyAccess(existing.playerId);
  const account = await prisma.parentAccount.delete({ where: { id: accountId } });
  revalidatePath(`/joueurs/${account.playerId}`);
}
