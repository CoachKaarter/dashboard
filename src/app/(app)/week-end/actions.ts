"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam, canManageCategory, getAccessibleCategories, type AuthedUser } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { getWeekendDate } from "@/lib/availability";
import { convocationsToCreate } from "@/lib/weekend-convocations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getPlanWeekendDate(weekStartDate: Date) {
  return getWeekendDate(weekStartDate);
}

// WeekendPlan is one global row per weekend, spanning every category that
// has assignments that weekend — it has no per-category split. So a
// Responsable can only validate/reopen/publish it when they manage EVERY
// category actually involved that weekend (never just one of several), or
// — for a still-empty plan — when they manage at least one category at
// all, so the action isn't unusable before the first assignment exists.
async function assertCanManageWeekend(user: AuthedUser, weekendDate: Date) {
  const involvedTeams = await prisma.team.findMany({
    where: { weekendAssignments: { some: { weekendDate } } },
    select: { category: true },
    distinct: ["category"],
  });
  if (involvedTeams.length > 0) {
    const categories = [...new Set(involvedTeams.map((t) => t.category))];
    if (!categories.every((c) => canManageCategory(user, c))) redirect("/");
    return;
  }
  // Nothing assigned yet this weekend — any Responsable can act, there's
  // nothing outside their perimeter to accidentally validate/publish.
  if (!getAccessibleCategories(user).some((c) => canManageCategory(user, c))) redirect("/");
}

export async function assignPlayerToTeam(weekStartIso: string, playerId: string, teamId: string) {
  const user = await requireUser();
  if (!canAccessTeam(user, teamId)) return;
  const weekStartDate = new Date(weekStartIso);
  const weekendDate = await getPlanWeekendDate(weekStartDate);

  const [player, match] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: true } }),
    prisma.match.findFirst({ where: { teamId, date: weekendDate } }),
  ]);

  await prisma.weekendAssignment.upsert({
    where: { weekendDate_playerId: { weekendDate, playerId } },
    update: { teamId, matchId: match?.id ?? null, assignedById: user.id },
    create: { weekStartDate, weekendDate, playerId, teamId, matchId: match?.id ?? null, assignedById: user.id },
  });

  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
  await logActivity({
    actorId: user.id,
    summary: `a affecté ${player.firstName} ${player.lastName} à ${team.code} pour le week-end du ${weekendDate.toISOString().slice(0, 10)}`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath("/week-end");
}

export async function unassignPlayer(weekStartIso: string, playerId: string) {
  const user = await requireUser();
  const weekendDate = await getPlanWeekendDate(new Date(weekStartIso));
  const existing = await prisma.weekendAssignment.findUnique({ where: { weekendDate_playerId: { weekendDate, playerId } } });
  if (!existing) return;
  if (!canAccessTeam(user, existing.teamId)) return;

  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  await prisma.weekendAssignment.delete({ where: { id: existing.id } });
  await logActivity({
    actorId: user.id,
    summary: `a retiré ${player.firstName} ${player.lastName} de la répartition du week-end du ${weekendDate.toISOString().slice(0, 10)}`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath("/week-end");
}

export async function assignMatchStaff(matchId: string, formData: FormData) {
  const user = await requireUser();
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  if (!canAccessTeam(user, match.teamId)) return;

  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "");
  if (!userId || !role) return;

  await prisma.matchStaffAssignment.upsert({
    where: { matchId_userId_role: { matchId, userId, role } },
    update: {},
    create: { matchId, userId, role },
  });
  revalidatePath("/week-end");
}

export async function removeMatchStaff(id: string) {
  const user = await requireUser();
  const row = await prisma.matchStaffAssignment.findUnique({ where: { id }, include: { match: true } });
  if (!row || !canAccessTeam(user, row.match.teamId)) return;
  await prisma.matchStaffAssignment.delete({ where: { id } });
  revalidatePath("/week-end");
}

// Global, one-row-per-weekend actions — WeekendPlan has no per-category
// split, so validating/reopening/publishing it requires Responsable-level
// coverage of every category actually involved that weekend (see
// assertCanManageWeekend above), not just ADMIN. Coaches keep their
// per-team actions above (assignPlayerToTeam, unassignPlayer, ...).
export async function validateWeekendPlan(weekStartIso: string) {
  const user = await requireUser();
  const weekStartDate = new Date(weekStartIso);
  const weekendDate = await getPlanWeekendDate(weekStartDate);
  await assertCanManageWeekend(user, weekendDate);

  await prisma.weekendPlan.upsert({
    where: { weekStartDate },
    update: { status: "VALIDATED", validatedAt: new Date(), validatedById: user.id },
    create: { weekStartDate, weekendDate, status: "VALIDATED", validatedAt: new Date(), validatedById: user.id },
  });
  await logActivity({ actorId: user.id, summary: `a validé le plan du week-end du ${weekendDate.toISOString().slice(0, 10)}` });
  revalidatePath("/week-end");
}

export async function reopenWeekendPlan(weekStartIso: string) {
  const user = await requireUser();
  const weekStartDate = new Date(weekStartIso);
  const weekendDate = await getPlanWeekendDate(weekStartDate);
  await assertCanManageWeekend(user, weekendDate);
  const plan = await prisma.weekendPlan.findUnique({ where: { weekStartDate } });
  const wasPublished = plan?.status === "PUBLISHED";

  await prisma.weekendPlan.update({ where: { weekStartDate }, data: { status: "DRAFT" } });
  await logActivity({
    actorId: user.id,
    summary: wasPublished
      ? `a rouvert le plan du week-end du ${weekendDate.toISOString().slice(0, 10)} — DES CONVOCATIONS ÉTAIENT DÉJÀ PUBLIÉES`
      : `a rouvert le plan du week-end du ${weekendDate.toISOString().slice(0, 10)}`,
  });
  revalidatePath("/week-end");
}

export async function generateWeekendConvocations(weekStartIso: string) {
  const user = await requireUser();
  const weekStartDate = new Date(weekStartIso);
  const weekendDate = await getPlanWeekendDate(weekStartDate);
  await assertCanManageWeekend(user, weekendDate);

  const [assignments, existingConvocations] = await Promise.all([
    prisma.weekendAssignment.findMany({ where: { weekendDate, matchId: { not: null } } }),
    prisma.matchConvocation.findMany({
      where: { match: { date: weekendDate } },
      select: { matchId: true, playerId: true },
    }),
  ]);

  // Sync, never silently drop: only add missing convocations for currently
  // assigned players. A player removed from the répartition after
  // publication keeps their MatchConvocation row (and any confirmation
  // already recorded) until the staff explicitly removes it from the fiche
  // match — this function only ever adds, per §13/§14. convocationsToCreate
  // is the pure, testable rule that makes clicking "Publier" twice a no-op.
  const existingKeys = new Set(existingConvocations.map((c) => `${c.matchId}:${c.playerId}`));
  const toCreate = convocationsToCreate(assignments, existingKeys);
  for (const { matchId, playerId } of toCreate) {
    await prisma.matchConvocation.create({ data: { matchId, playerId } });
  }
  const created = toCreate.length;

  await prisma.weekendPlan.upsert({
    where: { weekStartDate },
    update: { status: "PUBLISHED", publishedAt: new Date() },
    create: { weekStartDate, weekendDate, status: "PUBLISHED", publishedAt: new Date() },
  });
  await logActivity({
    actorId: user.id,
    summary: `a généré les convocations du week-end du ${weekendDate.toISOString().slice(0, 10)} (${created} nouvelle${created > 1 ? "s" : ""})`,
  });
  revalidatePath("/week-end");
  revalidatePath("/matchs");
}
