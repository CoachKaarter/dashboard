"use server";

import { toggleAlertTreated } from "@/lib/alerts";
import { requireUser } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function toggleTreated(key: string) {
  const user = await requireUser();
  await toggleAlertTreated(key, user.id);
  revalidatePath("/alertes");
  revalidatePath("/");
}
