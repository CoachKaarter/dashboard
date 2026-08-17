"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyTeamStaff } from "@/lib/notifications";

// Public, unauthenticated by design — this is the action behind a share link
// handed to players/parents who have no account. The token (not the raw
// match/player ids) is what proves the caller actually holds the link.
export async function confirmAttendance(token: string, playerId: string, confirmed: boolean) {
  const match = await prisma.match.findUnique({ where: { shareToken: token } });
  if (!match) return;
  await prisma.matchConvocation.updateMany({
    where: { matchId: match.id, playerId },
    data: { confirmed },
  });
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (player) {
    await notifyTeamStaff(match.teamId, {
      type: "convocation-response",
      title: `${player.firstName} ${player.lastName} a ${confirmed ? "confirmé" : "décliné"} sa convocation`,
      href: `/matchs/${match.id}`,
    });
  }
  revalidatePath(`/convocation/${token}`);
}
