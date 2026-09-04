import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/secure-token";
import { logActivity } from "@/lib/activity";
import { getClub } from "@/lib/club";

export type ActivationTokenCheck =
  | { status: "valid"; mode: "create"; invitationId: string; playerFirstName: string; playerLastName: string; clubName: string }
  | { status: "valid"; mode: "link"; invitationId: string; playerFirstName: string; playerLastName: string; clubName: string; existingUsername: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "used" }
  | { status: "revoked" };

/** GET-side check only — never mutates anything (§34 : GET valide, POST active). */
export async function checkActivationToken(token: string): Promise<ActivationTokenCheck> {
  const row = await prisma.parentInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { player: true } });
  if (!row) return { status: "invalid" };
  if (row.revokedAt) return { status: "revoked" };
  if (row.usedAt) return { status: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "expired" };

  const club = await getClub();
  const base = { status: "valid" as const, invitationId: row.id, playerFirstName: row.player.firstName, playerLastName: row.player.lastName, clubName: club.name };

  // Liaison automatique par email : si un compte famille actif existe déjà
  // pour cet email (typiquement un aîné déjà activé), ce joueur rejoint ce
  // compte plutôt que d'en créer un nouveau — voir activateParentAccount.
  const existingAccount = await prisma.parentAccount.findFirst({ where: { email: row.email, active: true } });
  if (existingAccount) return { ...base, mode: "link", existingUsername: existingAccount.username };
  return { ...base, mode: "create" };
}

export type ActivateResult =
  | { ok: true; mode: "created"; parentAccountId: string; username: string }
  | { ok: true; mode: "linked"; parentAccountId: string; username: string }
  | { ok: false; error: "invalid" | "expired" | "used" | "revoked" | "race" };

/**
 * POST-side, "create a brand new account" branch — creates the
 * ParentAccount (§11, Option A : jamais avant ce moment précis) with the
 * password the parent just chose, then consumes the invitation.
 * Everything happens in one transaction so a double submit (§55.8) can
 * only ever produce one account: the second call's re-check of usedAt
 * inside the same transaction isolation fails closed, and the
 * ParentAccountPlayer.playerId unique constraint is the hard backstop if
 * two requests truly race at the database level.
 *
 * Also re-checks the email-match condition inside the transaction (the
 * page only shows the password form when checkActivationToken said
 * "create", but that check ran on a separate request — a concurrent
 * activation of a sibling's invitation for the same email could have
 * created an account in between). If that race happens, the submitted
 * password is discarded and this becomes a "linked" result instead of
 * creating a second account.
 */
export async function activateParentAccount(token: string, password: string): Promise<ActivateResult> {
  const tokenHash = hashToken(token);
  const invitation = await prisma.parentInvitation.findUnique({ where: { tokenHash } });
  if (!invitation) return { ok: false, error: "invalid" };
  if (invitation.revokedAt) return { ok: false, error: "revoked" };
  if (invitation.usedAt) return { ok: false, error: "used" };
  if (invitation.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.parentInvitation.findUnique({ where: { id: invitation.id } });
      if (!fresh || fresh.usedAt || fresh.revokedAt || fresh.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      const existingAccount = await tx.parentAccount.findFirst({ where: { email: fresh.email, active: true } });

      const account = existingAccount
        ? existingAccount
        : await tx.parentAccount.create({
            data: { email: fresh.email, username: fresh.username, passwordHash, active: true, mustChangePassword: false },
          });
      await tx.parentAccountPlayer.create({ data: { parentAccountId: account.id, playerId: fresh.playerId } });

      await tx.parentInvitation.update({ where: { id: fresh.id }, data: { usedAt: new Date() } });
      // Un joueur n'a normalement qu'une invitation vivante à la fois (§6),
      // mais on ferme aussi toute autre invitation restée non révoquée par
      // sécurité plutôt que de faire confiance à cet invariant.
      await tx.parentInvitation.updateMany({
        where: { playerId: fresh.playerId, id: { not: fresh.id }, revokedAt: null, usedAt: null },
        data: { revokedAt: new Date() },
      });
      return { account, linked: Boolean(existingAccount) };
    });

    if (!result) return { ok: false, error: "used" };

    await logActivity({
      actorId: null,
      summary: result.linked ? `Enfant ajouté au compte famille existant (${result.account.username})` : `Compte famille activé (${result.account.username})`,
      entityType: "ParentAccount",
      entityId: result.account.id,
    });

    return { ok: true, mode: result.linked ? "linked" : "created", parentAccountId: result.account.id, username: result.account.username };
  } catch (e) {
    // P2002 : la contrainte unique ParentAccountPlayer.playerId a tranché
    // une course entre deux activations concurrentes du même lien.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "race" };
    }
    throw e;
  }
}

/**
 * POST-side, "join an existing family account" branch — no password
 * involved at all: possession of the invitation token (sent only to the
 * family's own email) plus the email match already proves this person is
 * the same family. Never signs the browser in (that always goes through
 * parentSignIn with real credentials, per the standing rule of never
 * hand-rolling a session cookie) — the caller redirects to /parent/login.
 */
export async function linkPlayerToExistingAccount(token: string): Promise<ActivateResult> {
  const tokenHash = hashToken(token);
  const invitation = await prisma.parentInvitation.findUnique({ where: { tokenHash } });
  if (!invitation) return { ok: false, error: "invalid" };
  if (invitation.revokedAt) return { ok: false, error: "revoked" };
  if (invitation.usedAt) return { ok: false, error: "used" };
  if (invitation.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.parentInvitation.findUnique({ where: { id: invitation.id } });
      if (!fresh || fresh.usedAt || fresh.revokedAt || fresh.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      const existingAccount = await tx.parentAccount.findFirst({ where: { email: fresh.email, active: true } });
      // Plus de compte actif pour cet email (désactivé entre-temps) — pas
      // de liaison possible, le parent doit repasser par le lien pour voir
      // le vrai écran de création de compte.
      if (!existingAccount) return null;

      await tx.parentAccountPlayer.create({ data: { parentAccountId: existingAccount.id, playerId: fresh.playerId } });
      await tx.parentInvitation.update({ where: { id: fresh.id }, data: { usedAt: new Date() } });
      await tx.parentInvitation.updateMany({
        where: { playerId: fresh.playerId, id: { not: fresh.id }, revokedAt: null, usedAt: null },
        data: { revokedAt: new Date() },
      });
      return existingAccount;
    });

    if (!result) return { ok: false, error: "used" };

    await logActivity({
      actorId: null,
      summary: `Enfant ajouté au compte famille existant (${result.username})`,
      entityType: "ParentAccount",
      entityId: result.id,
    });

    return { ok: true, mode: "linked", parentAccountId: result.id, username: result.username };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "race" };
    }
    throw e;
  }
}
