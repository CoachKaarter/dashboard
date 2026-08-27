import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/secure-token";
import { logActivity } from "@/lib/activity";
import { getClub } from "@/lib/club";

export type ActivationTokenCheck =
  | { status: "valid"; invitationId: string; playerFirstName: string; playerLastName: string; clubName: string }
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
  return { status: "valid", invitationId: row.id, playerFirstName: row.player.firstName, playerLastName: row.player.lastName, clubName: club.name };
}

export type ActivateResult =
  | { ok: true; parentAccountId: string; username: string }
  | { ok: false; error: "invalid" | "expired" | "used" | "revoked" | "race" };

/**
 * POST-side — creates the ParentAccount (§11, Option A : jamais avant ce
 * moment précis) with the password the parent just chose, then consumes
 * the invitation. Everything happens in one transaction so a double submit
 * (§55.8) can only ever produce one account: the second call's re-check of
 * usedAt inside the same transaction isolation fails closed, and the
 * ParentAccount.playerId unique constraint is the hard backstop if two
 * requests truly race at the database level.
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
    const account = await prisma.$transaction(async (tx) => {
      const fresh = await tx.parentInvitation.findUnique({ where: { id: invitation.id } });
      if (!fresh || fresh.usedAt || fresh.revokedAt || fresh.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      const created = await tx.parentAccount.create({
        data: { playerId: fresh.playerId, username: fresh.username, passwordHash, active: true, mustChangePassword: false },
      });
      await tx.parentInvitation.update({ where: { id: fresh.id }, data: { usedAt: new Date() } });
      // Un joueur n'a normalement qu'une invitation vivante à la fois (§6),
      // mais on ferme aussi toute autre invitation restée non révoquée par
      // sécurité plutôt que de faire confiance à cet invariant.
      await tx.parentInvitation.updateMany({
        where: { playerId: fresh.playerId, id: { not: fresh.id }, revokedAt: null, usedAt: null },
        data: { revokedAt: new Date() },
      });
      return created;
    });

    if (!account) return { ok: false, error: "used" };

    await logActivity({
      actorId: null,
      summary: `Compte famille activé (${account.username})`,
      entityType: "ParentAccount",
      entityId: account.id,
    });

    return { ok: true, parentAccountId: account.id, username: account.username };
  } catch (e) {
    // P2002 : la contrainte unique ParentAccount.playerId a tranché une
    // course entre deux activations concurrentes du même lien.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "race" };
    }
    throw e;
  }
}
