"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canManageCategory } from "@/lib/authz";
import { issueParentInvitation, type IssueInvitationResult } from "@/lib/parent-invitation";
import { revalidatePath } from "next/cache";

/**
 * Called once per player from a client-driven loop (FamilyAccessPanel)
 * rather than looping the whole selection inside a single request — same
 * reasoning as the original bulk account creation: stays within Vercel's
 * serverless duration limits and Resend's rate limit by construction, and
 * gives real per-player progress feedback.
 *
 * §38 : re-checks the PLAYER's own category, not just "does this user
 * manage something somewhere" — a Responsable U8/U9 selecting a U12 player
 * server-side would otherwise slip through a client-only filter.
 */
export async function sendInvitationBulkAction(playerId: string): Promise<IssueInvitationResult> {
  const user = await requireUser();
  const player = await prisma.player.findUnique({ where: { id: playerId }, include: { team: true } });
  if (!player) return { ok: false, playerId, playerName: "?", error: "Joueur introuvable." };
  if (user.role !== "ADMIN" && !canManageCategory(user, player.team.category)) {
    return { ok: false, playerId, playerName: `${player.firstName} ${player.lastName}`, error: "Hors de votre périmètre." };
  }

  const result = await issueParentInvitation(playerId, user.id);
  revalidatePath("/joueurs/comptes-familles");
  if (result.ok) revalidatePath(`/joueurs/${playerId}`);
  return result;
}
