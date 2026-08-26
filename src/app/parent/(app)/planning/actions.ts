"use server";

import { prisma } from "@/lib/prisma";
import { requireParentReady } from "@/lib/parent-guard";
import { notifyTeamStaff } from "@/lib/notifications";
import { recordResponseSnapshot, convocationSnapshot } from "@/lib/parent-content-state";
import { revalidatePath } from "next/cache";

/**
 * Migration path away from the shared /convocation/[token] link (§42) : a
 * connected parent confirms only for their own child, never sees the rest
 * of the squad. The token page still exists (staff may still prefer it for
 * a quick WhatsApp broadcast) but this is the account-scoped alternative
 * that doesn't leak the full convoked list to anyone holding a link.
 */
export async function confirmMyConvocation(matchId: string, confirmed: boolean) {
  const parent = await requireParentReady();
  const convocation = await prisma.matchConvocation.findUnique({
    where: { matchId_playerId: { matchId, playerId: parent.playerId } },
  });
  if (!convocation) return;

  await prisma.matchConvocation.update({ where: { id: convocation.id }, data: { confirmed } });

  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  // Ancre la réponse à CETTE version du match (Accueil Parent v2, Cycle 3) —
  // si le staff modifie ensuite date/horaire/adversaire, la carte redemandera
  // une confirmation au lieu de garder silencieusement une réponse obsolète.
  await recordResponseSnapshot(
    parent.parentAccountId,
    { entityType: "CONVOCATION", entityId: match.date.toISOString() },
    convocationSnapshot({ date: match.date, time: match.time, opponent: match.opponent, meetTime: match.meetTime, meetLocation: match.meetLocation, location: match.location })
  );
  await notifyTeamStaff(match.teamId, {
    type: "convocation-response",
    title: `${parent.player.firstName} ${parent.player.lastName} a ${confirmed ? "confirmé" : "décliné"} sa convocation`,
    href: `/matchs/${matchId}`,
  });
  revalidatePath("/parent/planning");
  revalidatePath("/parent/matchs");
  revalidatePath("/parent");
}
