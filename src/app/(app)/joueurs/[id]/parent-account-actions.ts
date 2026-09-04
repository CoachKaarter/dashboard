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

// Un compte peut désormais être partagé entre plusieurs enfants — une
// action qui affecte le compte entier (désactiver, supprimer, réinitialiser
// le mot de passe) doit donc être autorisée sur TOUS les enfants liés, pas
// seulement celui depuis la fiche duquel le staff a cliqué. Un Responsable
// qui ne gère qu'une partie des enfants du compte ne peut pas agir dessus.
async function assertCanManageAccount(accountId: string) {
  const account = await prisma.parentAccount.findUnique({
    where: { id: accountId },
    include: { players: { include: { player: true } } },
  });
  if (!account) return null;
  const user = await requireUser();
  const allowed = account.players.every((link) => user.role === "ADMIN" || canManageCategory(user, link.player.category));
  if (!allowed) redirect("/joueurs");
  return account;
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
  const account = await assertCanManageAccount(accountId);
  if (!account) return;
  await issuePasswordResetForAccount(accountId, null);
  for (const link of account.players) revalidatePath(`/joueurs/${link.playerId}`);
}

export async function setParentAccountActive(accountId: string, active: boolean) {
  const account = await assertCanManageAccount(accountId);
  if (!account) return;
  await prisma.parentAccount.update({ where: { id: accountId }, data: { active } });
  for (const link of account.players) revalidatePath(`/joueurs/${link.playerId}`);
}

// Unlike deletePlayer, this is low-stakes and reversible in effect (a new
// invitation can be issued right after) — the identifiant itself just goes
// back to being available. ParentContentState cascades with it (onDelete:
// Cascade); EquipmentAssignment.parentAccountId is set null (onDelete:
// SetNull) so loan history survives the account. Deleting a shared account
// deletes it for EVERY enfant lié at once — the UI must make that explicit
// before calling this (see ParentAccountPanel).
export async function deleteParentAccountAction(accountId: string) {
  const account = await assertCanManageAccount(accountId);
  if (!account) return;
  await prisma.parentAccount.delete({ where: { id: accountId } });
  for (const link of account.players) revalidatePath(`/joueurs/${link.playerId}`);
}
