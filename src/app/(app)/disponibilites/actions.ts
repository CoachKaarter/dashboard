"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { addDays, upsertAvailability } from "@/lib/availability";
import { revalidatePath } from "next/cache";

function nextWeekdayFrom(base: Date, weekday: number) {
  const diff = (weekday - base.getDay() + 7) % 7;
  return addDays(base, diff);
}

export async function openWindow(weekStartIso: string, formData: FormData) {
  await requireUser();
  const weekStart = new Date(weekStartIso);
  const weekEnd = addDays(weekStart, 6);
  const closesAtRaw = String(formData.get("closesAt") || "");
  const closesAt = closesAtRaw ? new Date(closesAtRaw) : (() => {
    const d = nextWeekdayFrom(weekStart, 3); // mercredi
    d.setHours(12, 0, 0, 0);
    return d;
  })();

  await prisma.weeklyAvailabilityWindow.upsert({
    where: { weekStartDate: weekStart },
    update: { status: "OPEN", opensAt: new Date(), closesAt },
    create: { weekStartDate: weekStart, weekEndDate: weekEnd, status: "OPEN", opensAt: new Date(), closesAt },
  });
  revalidatePath("/disponibilites");
  revalidatePath("/parent");
}

export async function closeWindow(weekStartIso: string) {
  await requireUser();
  const weekStart = new Date(weekStartIso);
  await prisma.weeklyAvailabilityWindow.update({ where: { weekStartDate: weekStart }, data: { status: "LOCKED" } });
  revalidatePath("/disponibilites");
  revalidatePath("/parent");
}

export async function reopenWindow(weekStartIso: string) {
  await requireUser();
  const weekStart = new Date(weekStartIso);
  await prisma.weeklyAvailabilityWindow.update({ where: { weekStartDate: weekStart }, data: { status: "OPEN" } });
  revalidatePath("/disponibilites");
  revalidatePath("/parent");
}

// Manual staff override — allowed regardless of window status, unlike the
// parent-facing actions in src/app/parent/(app)/actions.ts.
export async function setAvailabilityByStaff(
  playerId: string,
  type: "TRAINING" | "WEEKEND",
  sessionId: string | null,
  eventDateIso: string,
  weekStartIso: string,
  status: "AVAILABLE" | "UNAVAILABLE"
) {
  await requireUser();
  await upsertAvailability({
    playerId,
    type,
    sessionId,
    eventDate: new Date(eventDateIso),
    weekStartDate: new Date(weekStartIso),
    status,
    answeredBy: "STAFF",
  });
  revalidatePath("/disponibilites");
}
