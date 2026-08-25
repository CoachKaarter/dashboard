"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin, canAccessTeam } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

function revalidateMeasurementPaths(playerId: string) {
  revalidatePath("/mesures");
  revalidatePath("/mesures/saisie");
  revalidatePath(`/joueurs/${playerId}`);
}

export async function recordMeasurement(playerId: string, testTypeId: string, dateIso: string, formData: FormData) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return;

  const raw = String(formData.get("value") ?? "").trim();
  if (!raw) {
    // Clearing the field removes that day's entry rather than storing a
    // meaningless 0 — a blank cell must mean "not measured", not "measured
    // as zero".
    await prisma.physicalTestResult.deleteMany({ where: { playerId, testTypeId, date } });
  } else {
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    await prisma.physicalTestResult.upsert({
      where: { playerId_testTypeId_date: { playerId, testTypeId, date } },
      update: { value, recordedById: user.id },
      create: { playerId, testTypeId, date, value, recordedById: user.id },
    });
  }
  revalidateMeasurementPaths(playerId);
}

// Fiche-joueur equivalent of recordMeasurement — same upsert, but the test
// type and date come from the form itself (a free choice per add) rather
// than being fixed by the page context, since this is a one-off catch-up
// entry rather than a whole-squad measurement day.
export async function addPlayerMeasurement(playerId: string, formData: FormData) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  const testTypeId = String(formData.get("testTypeId") ?? "");
  const testType = await prisma.physicalTestType.findUnique({ where: { id: testTypeId } });
  if (!testType) return;

  const date = new Date(String(formData.get("date") ?? ""));
  if (Number.isNaN(date.getTime())) return;

  const value = Number(formData.get("value"));
  if (Number.isNaN(value)) return;
  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.physicalTestResult.upsert({
    where: { playerId_testTypeId_date: { playerId, testTypeId, date } },
    update: { value, note, recordedById: user.id },
    create: { playerId, testTypeId, date, value, note, recordedById: user.id },
  });
  revalidateMeasurementPaths(playerId);
}

export async function deleteMeasurement(playerId: string, resultId: string) {
  const user = await requireUser();
  const result = await prisma.physicalTestResult.findUniqueOrThrow({ where: { id: resultId }, include: { player: true } });
  if (result.playerId !== playerId || !canAccessTeam(user, result.player.teamId)) return;
  await prisma.physicalTestResult.delete({ where: { id: resultId } });
  revalidateMeasurementPaths(playerId);
}

// Test-type catalog management (which tests exist at all) is admin-only —
// it's shared taxonomy across the whole club, same governance level as
// Settings/Club branding elsewhere in the app. Recording a result for an
// existing test type stays open to any staff scoped to that player's team.
export async function createTestType(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const lowerIsBetter = formData.get("lowerIsBetter") === "on";
  if (!name || !unit) return;

  const maxOrder = await prisma.physicalTestType.aggregate({ _max: { order: true } });
  await prisma.physicalTestType.create({
    data: { name, unit, lowerIsBetter, order: (maxOrder._max.order ?? -1) + 1 },
  });
  await logActivity({ actorId: admin.id, summary: `a ajouté le test physique "${name}"`, entityType: "PhysicalTestType" });
  revalidatePath("/mesures");
  revalidatePath("/mesures/saisie");
}

export async function setTestTypeActive(testTypeId: string, active: boolean) {
  const admin = await requireAdmin();
  const testType = await prisma.physicalTestType.update({ where: { id: testTypeId }, data: { active } });
  await logActivity({
    actorId: admin.id,
    summary: `a ${active ? "réactivé" : "masqué"} le test physique "${testType.name}"`,
    entityType: "PhysicalTestType",
  });
  revalidatePath("/mesures");
  revalidatePath("/mesures/saisie");
}
