"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { PLAYER_STATUSES, POSITIONS } from "@/lib/constants";
import { logActivity } from "@/lib/activity";

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
  const toTeam = await prisma.team.findUnique({ where: { id: toTeamId } });
  await logActivity({
    actorId: user.id,
    summary: `a changé le groupe de ${player.firstName} ${player.lastName} vers ${toTeam?.code ?? toTeamId} (${reason})`,
    entityType: "Player",
    entityId: playerId,
  });
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
  await logActivity({
    actorId: user.id,
    summary: `a changé le statut de ${player.firstName} ${player.lastName} en ${status}`,
    entityType: "Player",
    entityId: playerId,
  });
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

const UNAVAILABILITY_TYPES = ["Blessure", "Maladie", "Absence longue", "Autre"];
const STATUS_BY_TYPE: Record<string, string> = {
  Blessure: "Blessé",
  Maladie: "Malade",
  "Absence longue": "Incertain",
  Autre: "Incertain",
};

export async function declareUnavailability(playerId: string, formData: FormData) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  const type = String(formData.get("type") ?? "");
  if (!UNAVAILABILITY_TYPES.includes(type)) return;
  const description = String(formData.get("description") || "").trim() || null;
  const startDate = new Date(String(formData.get("startDate") || new Date().toISOString().slice(0, 10)));
  const expectedReturnRaw = String(formData.get("expectedReturn") || "");
  const expectedReturn = expectedReturnRaw ? new Date(expectedReturnRaw) : null;

  await prisma.$transaction([
    prisma.unavailability.create({
      data: { playerId, type, description, startDate, expectedReturn, createdById: user.id },
    }),
    prisma.player.update({ where: { id: playerId }, data: { status: STATUS_BY_TYPE[type] } }),
  ]);
  await logActivity({
    actorId: user.id,
    summary: `a déclaré ${player.firstName} ${player.lastName} indisponible (${type})`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
  revalidatePath("/");
}

export async function endUnavailability(playerId: string, unavailabilityId: string) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  await prisma.$transaction([
    prisma.unavailability.update({ where: { id: unavailabilityId }, data: { actualReturn: new Date() } }),
    prisma.player.update({ where: { id: playerId }, data: { status: "Actif" } }),
  ]);
  await logActivity({
    actorId: user.id,
    summary: `a marqué ${player.firstName} ${player.lastName} de retour`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
  revalidatePath("/");
}

export async function setArchived(playerId: string, archived: boolean) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  await prisma.player.update({ where: { id: playerId }, data: { archived } });
  await logActivity({
    actorId: user.id,
    summary: `a ${archived ? "archivé" : "réactivé"} ${player.firstName} ${player.lastName}`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/joueurs");
}
