import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateUsername, generateTempPassword } from "@/lib/parent-account";
import { sendParentCredentialsEmail } from "@/lib/email";
import { getClub } from "@/lib/club";

// Shared by the single-player action (fiche joueur) and the bulk action
// (comptes-familles) — one place that creates the account, generates the
// credentials, and best-effort emails them, so the two flows can never
// drift into different behavior.
export type EmailStatus = "sent" | "failed" | "none";

export type CreateAccountResult =
  | {
      ok: true;
      playerId: string;
      playerName: string;
      username: string;
      tempPassword: string;
      emailStatus: EmailStatus;
      emailError?: string;
    }
  | { ok: false; playerId: string; playerName: string; error: string };

export async function createParentAccountForPlayer(playerId: string): Promise<CreateAccountResult> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { ok: false, playerId, playerName: "?", error: "Joueur introuvable." };
  const playerName = `${player.firstName} ${player.lastName}`;

  const existing = await prisma.parentAccount.findUnique({ where: { playerId } });
  if (existing) return { ok: false, playerId, playerName, error: "Un compte existe déjà pour ce joueur." };

  const username = await generateUsername(player.firstName, player.lastName);
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.parentAccount.create({ data: { playerId, username, passwordHash, mustChangePassword: true } });

  const { emailStatus, emailError } = await tryEmailCredentials(player.parentEmail, {
    playerFirstName: player.firstName,
    playerLastName: player.lastName,
    username,
    tempPassword,
  });

  return { ok: true, playerId, playerName, username, tempPassword, emailStatus, emailError };
}

export type ResetPasswordResult =
  | { ok: true; accountId: string; username: string; tempPassword: string; emailStatus: EmailStatus; emailError?: string }
  | { ok: false; accountId: string; error: string };

export async function resetParentPasswordForAccount(accountId: string): Promise<ResetPasswordResult> {
  const account = await prisma.parentAccount.findUnique({ where: { id: accountId }, include: { player: true } });
  if (!account) return { ok: false, accountId, error: "Compte introuvable." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.parentAccount.update({ where: { id: accountId }, data: { passwordHash, mustChangePassword: true } });

  const { emailStatus, emailError } = await tryEmailCredentials(account.player.parentEmail, {
    playerFirstName: account.player.firstName,
    playerLastName: account.player.lastName,
    username: account.username,
    tempPassword,
  });

  return { ok: true, accountId, username: account.username, tempPassword, emailStatus, emailError };
}

async function tryEmailCredentials(
  parentEmail: string | null,
  input: { playerFirstName: string; playerLastName: string; username: string; tempPassword: string }
): Promise<{ emailStatus: EmailStatus; emailError?: string }> {
  if (!parentEmail) return { emailStatus: "none" };

  const club = await getClub();
  const result = await sendParentCredentialsEmail({ to: parentEmail, clubName: club.name, ...input });
  return result.ok ? { emailStatus: "sent" } : { emailStatus: "failed", emailError: result.error };
}
