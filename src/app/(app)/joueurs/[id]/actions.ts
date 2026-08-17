"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { PLAYER_STATUSES, POSITIONS } from "@/lib/constants";

export async function addPlayerNote(playerId: string, formData: FormData) {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  await prisma.playerNote.create({
    data: { playerId, authorId: user.id, text },
  });
  revalidatePath(`/joueurs/${playerId}`);
}

export async function changeTeam(playerId: string, formData: FormData) {
  const user = await requireUser();
  const toTeamId = String(formData.get("toTeamId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Changement de groupe";
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!toTeamId || toTeamId === player.teamId) return;
  if (!canAccessTeam(user, player.teamId) || !canAccessTeam(user, toTeamId)) return;

  await prisma.$transaction([
    prisma.player.update({ where: { id: playerId }, data: { teamId: toTeamId } }),
    prisma.teamHistoryEntry.create({
      data: {
        playerId,
        fromTeamId: player.teamId,
        toTeamId,
        date: new Date(),
        reason,
        decidedById: user.id,
      },
    }),
  ]);
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
}

export async function changeStatus(playerId: string, formData: FormData) {
  const user = await requireUser();
  const status = String(formData.get("status") ?? "");
  if (!PLAYER_STATUSES.includes(status)) return;
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  await prisma.player.update({ where: { id: playerId }, data: { status } });
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
  revalidatePath("/");
}

export async function updatePlayer(playerId: string, formData: FormData) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  const position = String(formData.get("position") ?? "");
  const positionAlt = String(formData.get("positionAlt") ?? "");
  const foot = String(formData.get("foot") ?? "");
  const birthYear = Number(formData.get("birthYear"));
  const joinedLabel = String(formData.get("joinedLabel") ?? "").trim();
  if (!POSITIONS.includes(position) || !birthYear || !joinedLabel) return;

  await prisma.player.update({
    where: { id: playerId },
    data: { position, positionAlt: positionAlt || position, foot: foot || "Non renseigné", birthYear, joinedLabel },
  });
  revalidatePath(`/joueurs/${playerId}`);
}

export async function setArchived(playerId: string, archived: boolean) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  await prisma.player.update({ where: { id: playerId }, data: { archived } });
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
}
