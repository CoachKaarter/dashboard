"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addPlayerNote(playerId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  await prisma.playerNote.create({
    data: { playerId, authorId: session.user.id, text },
  });
  revalidatePath(`/joueurs/${playerId}`);
}
