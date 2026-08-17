"use server";

import { setAlertDecision, clearAlertDecision } from "@/lib/alerts";
import { requireUser } from "@/lib/authz";
import { revalidatePath } from "next/cache";

function nextFriday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export async function decideAlert(key: string, formData: FormData) {
  const user = await requireUser();
  const status = String(formData.get("status") ?? "TRAITE");
  const comment = String(formData.get("comment") || "").trim() || null;
  const assignedToId = String(formData.get("assignedToId") || "") || null;
  const snoozeUntilRaw = String(formData.get("snoozeUntil") || "");
  const snoozeUntil = status === "REVOIR" ? nextFriday() : status === "IGNORE" && snoozeUntilRaw ? new Date(snoozeUntilRaw) : null;

  await setAlertDecision(key, user.id, { status, snoozeUntil, comment, assignedToId });
  revalidatePath("/alertes");
  revalidatePath("/");
}

export async function reopenAlert(key: string) {
  await requireUser();
  await clearAlertDecision(key);
  revalidatePath("/alertes");
  revalidatePath("/");
}
