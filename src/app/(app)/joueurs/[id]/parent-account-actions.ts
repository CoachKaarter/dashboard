"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { createParentAccountForPlayer, resetParentPasswordForAccount, type EmailStatus } from "@/lib/parent-account-creation";
import { revalidatePath } from "next/cache";

type CredentialsResult = { username: string; tempPassword: string; emailStatus: EmailStatus; emailError?: string };

export async function createParentAccountAction(
  _prev: CredentialsResult | { error: string } | null,
  formData: FormData
): Promise<CredentialsResult | { error: string }> {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");

  const result = await createParentAccountForPlayer(playerId);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/joueurs/${playerId}`);
  return { username: result.username, tempPassword: result.tempPassword, emailStatus: result.emailStatus, emailError: result.emailError };
}

export async function resetParentPasswordAction(
  _prev: CredentialsResult | { error: string } | null,
  formData: FormData
): Promise<CredentialsResult | { error: string }> {
  await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");

  const result = await resetParentPasswordForAccount(accountId);
  if (!result.ok) return { error: result.error };

  const account = await prisma.parentAccount.findUnique({ where: { id: accountId } });
  if (account) revalidatePath(`/joueurs/${account.playerId}`);
  return { username: result.username, tempPassword: result.tempPassword, emailStatus: result.emailStatus, emailError: result.emailError };
}

export async function setParentAccountActive(accountId: string, active: boolean) {
  await requireAdmin();
  const account = await prisma.parentAccount.update({ where: { id: accountId }, data: { active } });
  revalidatePath(`/joueurs/${account.playerId}`);
}
