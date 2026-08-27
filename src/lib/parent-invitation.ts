import { prisma } from "@/lib/prisma";
import { generateUsername } from "@/lib/parent-account";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { sendParentInvitationEmail } from "@/lib/email";
import { getClub } from "@/lib/club";
import { logActivity } from "@/lib/activity";

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000; // §5 du cahier des charges
const APP_URL = process.env.APP_URL ?? "https://onzevo.website";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw);
}

export type IssueInvitationResult =
  | { ok: true; playerId: string; playerName: string; email: string }
  | { ok: false; playerId: string; playerName: string; error: string };

/**
 * Creates and sends one invitation, atomically from the caller's point of
 * view — this is deliberately the ONLY way an invitation email goes out
 * (single send, resend, bulk send all call this same function per player)
 * so there's exactly one code path that ever puts a raw token in an email.
 * §6 (un seul lien actif) : any previous non-revoked invitation for this
 * player is revoked first. §12 (Option A) : the username is reserved once
 * and reused across resends rather than regenerated, so the same parent
 * always ends up with the same identifiant regardless of how many times
 * the invitation had to be resent.
 */
export async function issueParentInvitation(playerId: string, actorUserId: string | null): Promise<IssueInvitationResult> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { ok: false, playerId, playerName: "?", error: "Joueur introuvable." };
  const playerName = `${player.firstName} ${player.lastName}`;

  if (!player.parentEmail) return { ok: false, playerId, playerName, error: "Email parent manquant." };
  const email = normalizeEmail(player.parentEmail);
  if (!isValidEmail(email)) return { ok: false, playerId, playerName, error: "Email parent invalide." };

  const existingAccount = await prisma.parentAccount.findUnique({ where: { playerId } });
  if (existingAccount) {
    return {
      ok: false,
      playerId,
      playerName,
      error: existingAccount.active
        ? "Un compte actif existe déjà pour ce joueur."
        : "Un compte désactivé existe déjà pour ce joueur — réactivez-le plutôt que d'inviter à nouveau.",
    };
  }

  const priorInvitation = await prisma.parentInvitation.findFirst({
    where: { playerId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const username = priorInvitation ? priorInvitation.username : await generateUsername(player.firstName, player.lastName);

  const { token, tokenHash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  // Revoke-then-create, not a single update, so a resend never leaves two
  // rows with the same tokenHash-uniqueness window in a half-consistent
  // state, and so old activation links visibly stop working (§6, §29).
  const invitation = await prisma.$transaction(async (tx) => {
    if (priorInvitation) {
      await tx.parentInvitation.update({ where: { id: priorInvitation.id }, data: { revokedAt: new Date() } });
    }
    return tx.parentInvitation.create({
      data: { playerId, email, username, tokenHash, expiresAt, createdById: actorUserId },
    });
  });

  const club = await getClub();
  const clubLogoUrl = club.hasLogo ? `${APP_URL}/api/club/logo?v=${club.logoVersion}` : null;
  const activationUrl = `${APP_URL}/parent/activation/${token}`;

  const emailResult = await sendParentInvitationEmail({
    to: email,
    clubName: club.name,
    clubLogoUrl,
    playerFirstName: player.firstName,
    playerLastName: player.lastName,
    activationUrl,
  });

  if (emailResult.ok) {
    await prisma.parentInvitation.update({ where: { id: invitation.id }, data: { sentAt: new Date() } });
  }

  // Never the token, the URL, or anything password-shaped — just who/when.
  if (!emailResult.ok) {
    await logActivity({
      actorId: actorUserId,
      summary: `Échec d'envoi de l'invitation famille à ${playerName} (${emailResult.error})`,
      entityType: "ParentInvitation",
      entityId: invitation.id,
    });
    return { ok: false, playerId, playerName, error: `Échec de l'envoi de l'email (${emailResult.error})` };
  }

  await logActivity({
    actorId: actorUserId,
    summary: `Invitation famille envoyée à ${playerName}`,
    entityType: "ParentInvitation",
    entityId: invitation.id,
  });
  return { ok: true, playerId, playerName, email };
}

export type RevokeInvitationResult = { ok: true } | { ok: false; error: string };

export async function revokeLatestInvitationForPlayer(playerId: string, actorUserId: string | null): Promise<RevokeInvitationResult> {
  const invitation = await prisma.parentInvitation.findFirst({
    where: { playerId, revokedAt: null, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!invitation) return { ok: false, error: "Aucune invitation active pour ce joueur." };

  await prisma.parentInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await logActivity({
    actorId: actorUserId,
    summary: `Invitation famille révoquée (joueur ${playerId})`,
    entityType: "ParentInvitation",
    entityId: invitation.id,
  });
  return { ok: true };
}

export function tokenHashOf(token: string) {
  return hashToken(token);
}
