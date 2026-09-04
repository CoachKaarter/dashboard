import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { sendParentPasswordResetEmail } from "@/lib/email";
import { getClub } from "@/lib/club";
import { logActivity } from "@/lib/activity";

const RESET_TTL_MS = 30 * 60 * 1000; // §32 : 30 minutes, plus court que les 72h d'une invitation
const APP_URL = process.env.APP_URL ?? "https://onzevo.website";

/**
 * Toujours appelée avec un compte réel et actif déjà résolu — la réponse
 * générique ("si un compte existe...") est la responsabilité de l'appelant
 * public (requestPasswordReset ci-dessous), jamais de cette fonction, pour
 * que le chemin "staff clique Réinitialiser sur la fiche joueur" (qui SAIT
 * que le compte existe) puisse aussi s'en servir directement.
 */
export async function issuePasswordResetForAccount(accountId: string, actorUserId: string | null): Promise<{ ok: boolean }> {
  const account = await prisma.parentAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.active) return { ok: false };

  // Un seul lien actif : les précédents (non utilisés) sont expirés
  // immédiatement plutôt qu'ajoutés à une colonne "revokedAt" séparée —
  // même effet, un champ en moins sur ce modèle.
  await prisma.parentPasswordResetToken.updateMany({
    where: { parentAccountId: accountId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const { token, tokenHash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await prisma.parentPasswordResetToken.create({ data: { parentAccountId: accountId, tokenHash, expiresAt } });

  const club = await getClub();
  const resetUrl = `${APP_URL}/parent/reinitialiser/${token}`;
  const result = await sendParentPasswordResetEmail({
    to: account.email,
    clubName: club.name,
    clubLogoUrl: club.hasLogo ? `${APP_URL}/api/club/logo?v=${club.logoVersion}` : null,
    resetUrl,
  });

  await logActivity({
    actorId: actorUserId,
    summary: result.ok
      ? `Email de réinitialisation envoyé (compte ${account.username})`
      : `Échec d'envoi de l'email de réinitialisation (compte ${account.username})`,
    entityType: "ParentAccount",
    entityId: account.id,
  });

  return { ok: result.ok };
}

/**
 * Point d'entrée public ("mot de passe oublié") — §31 : ne révèle JAMAIS si
 * l'identifiant/email correspond à un compte. L'appelant doit toujours
 * afficher le même message générique quel que soit ce que cette fonction a
 * fait en interne.
 */
export async function requestPasswordReset(identifier: string): Promise<void> {
  const id = identifier.trim().toLowerCase();
  if (!id) return;

  const account = await prisma.parentAccount.findFirst({
    where: {
      active: true,
      OR: [{ username: id }, { email: { equals: id, mode: "insensitive" } }],
    },
  });
  if (!account) return;

  await issuePasswordResetForAccount(account.id, null);
}

export type ResetTokenCheck =
  | { status: "valid"; accountId: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "used" };

export async function checkResetToken(token: string): Promise<ResetTokenCheck> {
  const row = await prisma.parentPasswordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row) return { status: "invalid" };
  if (row.usedAt) return { status: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  return { status: "valid", accountId: row.parentAccountId };
}

export async function consumeResetToken(
  token: string,
  newPassword: string
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const check = await checkResetToken(token);
  if (check.status !== "valid") return { ok: false, error: check.status };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [account] = await prisma.$transaction([
    prisma.parentAccount.update({ where: { id: check.accountId }, data: { passwordHash, mustChangePassword: false } }),
    prisma.parentPasswordResetToken.update({ where: { tokenHash: hashToken(token) }, data: { usedAt: new Date() } }),
  ]);
  await logActivity({
    actorId: null,
    summary: `Mot de passe réinitialisé par le parent (compte ${check.accountId})`,
    entityType: "ParentAccount",
    entityId: check.accountId,
  });
  return { ok: true, username: account.username };
}
