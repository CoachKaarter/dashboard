"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { generateUsername, generateTempPassword } from "@/lib/parent-account";
import { revalidatePath } from "next/cache";

export async function createParentAccountAction(
  _prev: { username: string; tempPassword: string } | { error: string } | null,
  formData: FormData
) {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { error: "Joueur introuvable." };

  const existing = await prisma.parentAccount.findUnique({ where: { playerId } });
  if (existing) return { error: "Un compte existe déjà pour ce joueur." };

  const username = await generateUsername(player.firstName, player.lastName);
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.parentAccount.create({
    data: { playerId, username, passwordHash, mustChangePassword: true },
  });
  revalidatePath(`/joueurs/${playerId}`);
  return { username, tempPassword };
}

export async function resetParentPasswordAction(
  _prev: { username: string; tempPassword: string } | { error: string } | null,
  formData: FormData
) {
  await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const account = await prisma.parentAccount.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Compte introuvable." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.parentAccount.update({
    where: { id: accountId },
    data: { passwordHash, mustChangePassword: true },
  });
  revalidatePath(`/joueurs/${account.playerId}`);
  return { username: account.username, tempPassword };
}

export async function setParentAccountActive(accountId: string, active: boolean) {
  await requireAdmin();
  const account = await prisma.parentAccount.update({ where: { id: accountId }, data: { active } });
  revalidatePath(`/joueurs/${account.playerId}`);
}
