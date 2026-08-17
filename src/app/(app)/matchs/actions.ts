"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canAccessTeam } from "@/lib/authz";

async function assertMatchAccess(matchId: string) {
  const user = await requireUser();
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId }, select: { teamId: true } });
  if (!canAccessTeam(user, match.teamId)) throw new Error("Accès refusé.");
  return user;
}

export async function toggleConvocation(matchId: string, playerId: string) {
  await assertMatchAccess(matchId);
  const existing = await prisma.matchConvocation.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });
  if (existing) {
    await prisma.matchConvocation.delete({ where: { id: existing.id } });
    // also drop any composition slot for that player on this match
    await prisma.compositionSlot.deleteMany({ where: { matchId, playerId } });
  } else {
    await prisma.matchConvocation.create({ data: { matchId, playerId } });
  }
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/");
}

export async function assignSlot(matchId: string, slotIndex: number, playerId: string) {
  await assertMatchAccess(matchId);
  await prisma.compositionSlot.deleteMany({ where: { matchId, playerId } });
  await prisma.compositionSlot.deleteMany({ where: { matchId, slotIndex } });
  await prisma.compositionSlot.create({ data: { matchId, slotIndex, playerId } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function clearSlot(matchId: string, slotIndex: number) {
  await assertMatchAccess(matchId);
  await prisma.compositionSlot.deleteMany({ where: { matchId, slotIndex } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function setFormation(matchId: string, formation: string) {
  await assertMatchAccess(matchId);
  await prisma.match.update({ where: { id: matchId }, data: { formation } });
  await prisma.compositionSlot.deleteMany({ where: { matchId } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function recordScore(matchId: string, formData: FormData) {
  await assertMatchAccess(matchId);
  const scoreFor = Number(formData.get("scoreFor"));
  const scoreAgainst = Number(formData.get("scoreAgainst"));
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "Joué", scoreFor, scoreAgainst },
  });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/");
}

export async function generateFeuille(matchId: string) {
  await assertMatchAccess(matchId);
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { convocations: true, slots: true },
  });
  const placedIds = new Set(match.slots.map((s) => s.playerId));
  const bench = match.convocations.map((c) => c.playerId).filter((id) => !placedIds.has(id));

  const rows = [
    ...match.slots.sort((a, b) => a.slotIndex - b.slotIndex).map((s) => ({ playerId: s.playerId, role: "Titulaire" })),
    ...bench.map((playerId) => ({ playerId, role: "Remplaçant" })),
  ];

  await prisma.$transaction(
    rows.map((r) =>
      prisma.matchPlayerStat.upsert({
        where: { matchId_playerId: { matchId, playerId: r.playerId } },
        update: {},
        create: {
          matchId,
          playerId: r.playerId,
          role: r.role,
          minutes: 0, // à confirmer par le coach — la composition ne détermine pas les minutes réelles
          goals: 0,
          assists: 0,
          note: null,
        },
      })
    )
  );
  revalidatePath(`/matchs/${matchId}`);
}

export async function updateStatRow(matchId: string, playerId: string, formData: FormData) {
  await assertMatchAccess(matchId);
  const minutes = Number(formData.get("minutes"));
  const goals = Number(formData.get("goals"));
  const assists = Number(formData.get("assists"));
  const noteRaw = formData.get("note");
  const note = noteRaw ? Number(noteRaw) : null;
  await prisma.matchPlayerStat.update({
    where: { matchId_playerId: { matchId, playerId } },
    data: { minutes, goals, assists, note },
  });
  revalidatePath(`/matchs/${matchId}`);
}

export async function createMatch(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId"));
  if (!canAccessTeam(user, teamId)) return;
  const opponent = String(formData.get("opponent") || "") || null;
  const competition = String(formData.get("competition"));
  const date = new Date(String(formData.get("date")));
  const time = String(formData.get("time") || "") || null;
  const isHome = formData.get("isHome") === "on";
  const location = String(formData.get("location") || "") || null;
  const needed = Number(formData.get("needed")) || 12;

  const match = await prisma.match.create({
    data: { teamId, opponent, competition, date, time, isHome, location, needed, status: "Planifié" },
  });
  revalidatePath("/matchs");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/matchs/${match.id}`);
}
