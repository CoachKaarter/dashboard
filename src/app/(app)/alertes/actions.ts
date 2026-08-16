"use server";

import { toggleAlertTreated } from "@/lib/alerts";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function toggleTreated(key: string) {
  const session = await auth();
  await toggleAlertTreated(key, session?.user?.id ?? "");
  revalidatePath("/alertes");
  revalidatePath("/");
}
