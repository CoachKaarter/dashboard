"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

const RATINGS = ["Très difficile", "Difficile", "Correcte", "Bonne", "Très bonne"];

async function assertAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
  return { user, session };
}

// Le mini-bilan (§40) reste facultatif et léger — journalisé via
// ActivityLog plutôt qu'un nouveau champ dédié, cohérent avec le reste des
// notes staff ponctuelles de l'application.
export async function terminerSeance(sessionId: string, formData: FormData) {
  const { user, session } = await assertAccess(sessionId);
  const rating = String(formData.get("rating") || "");
  const comment = String(formData.get("comment") || "").trim();

  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Réalisée" } });

  const bilanParts = [rating && RATINGS.includes(rating) ? `ressenti : ${rating}` : null, comment || null].filter(Boolean);
  await logActivity({
    actorId: user.id,
    summary: `a terminé la séance ${session.category} du ${session.date.toLocaleDateString("fr-FR")}${
      bilanParts.length ? ` — ${bilanParts.join(" · ")}` : ""
    }`,
    entityType: "TrainingSession",
    entityId: sessionId,
  });

  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
  revalidatePath("/");
}
