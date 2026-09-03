"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireResponsableOrAdmin, canManageCategory } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { matchDataFromInvitation } from "@/lib/tournament-invitation";

// ADMIN passe toujours, même sans StaffAccess explicite — canManageCategory
// seul ne le laisserait pas passer (il ne lit que les scopes StaffAccess,
// jamais le rôle technique) : même garde que createMatch (matchs/actions.ts).
async function assertInvitationAccess(invitationId: string) {
  const user = await requireUser();
  const invitation = await prisma.tournamentInvitation.findUniqueOrThrow({ where: { id: invitationId } });
  if (user.role !== "ADMIN" && !invitation.categories.some((c) => canManageCategory(user, c))) throw new Error("Accès refusé.");
  return { user, invitation };
}

export async function createInvitation(formData: FormData) {
  const user = await requireResponsableOrAdmin();
  const organizingClub = String(formData.get("organizingClub") || "").trim();
  const dateRaw = String(formData.get("date") || "");
  const date = new Date(dateRaw);
  const location = String(formData.get("location") || "").trim() || null;
  // Ne jamais faire confiance aux catégories du formulaire telles quelles —
  // un Responsable U8 ne peut pas s'inventer une invitation U13.
  const submittedCategories = formData.getAll("categories").map(String).filter(Boolean);
  const categories = user.role === "ADMIN" ? submittedCategories : submittedCategories.filter((c) => canManageCategory(user, c));
  const responseDeadlineRaw = String(formData.get("responseDeadline") || "");
  const responseDeadline = responseDeadlineRaw ? new Date(responseDeadlineRaw) : null;
  const practicalInfo = String(formData.get("practicalInfo") || "").trim() || null;

  if (!organizingClub || Number.isNaN(date.getTime()) || categories.length === 0) return;
  if (responseDeadlineRaw && responseDeadline && Number.isNaN(responseDeadline.getTime())) return;

  const invitation = await prisma.tournamentInvitation.create({
    data: { organizingClub, date, location, categories, responseDeadline, practicalInfo, createdById: user.id },
  });
  await logActivity({
    actorId: user.id,
    summary: `a enregistré une invitation de tournoi de ${organizingClub} (${categories.join(", ")})`,
    entityType: "TournamentInvitation",
    entityId: invitation.id,
  });
  revalidatePath("/tournois");
}

export async function decideInvitation(invitationId: string, status: "ACCEPTEE" | "REFUSEE") {
  if (status !== "ACCEPTEE" && status !== "REFUSEE") return;
  const { user, invitation } = await assertInvitationAccess(invitationId);

  await prisma.tournamentInvitation.update({
    where: { id: invitationId },
    data: { status, decidedAt: new Date(), decidedById: user.id },
  });
  await logActivity({
    actorId: user.id,
    summary: `a ${status === "ACCEPTEE" ? "accepté" : "refusé"} l'invitation de tournoi de ${invitation.organizingClub}`,
    entityType: "TournamentInvitation",
    entityId: invitationId,
  });
  revalidatePath("/tournois");
}

// Erreur de clic — repasse une invitation déjà décidée en attente, même
// esprit que reopenWeekendPlan (week-end/actions.ts) : jamais bloquant côté
// données, un match déjà créé depuis cette invitation garde son lien.
export async function reopenInvitation(invitationId: string) {
  const { user, invitation } = await assertInvitationAccess(invitationId);
  await prisma.tournamentInvitation.update({
    where: { id: invitationId },
    data: { status: "EN_ATTENTE", decidedAt: null, decidedById: null },
  });
  await logActivity({
    actorId: user.id,
    summary: `a rouvert l'invitation de tournoi de ${invitation.organizingClub}`,
    entityType: "TournamentInvitation",
    entityId: invitationId,
  });
  revalidatePath("/tournois");
}

export async function createMatchFromInvitation(invitationId: string, teamId: string) {
  const user = await requireUser();
  const [invitation, team] = await Promise.all([
    prisma.tournamentInvitation.findUniqueOrThrow({ where: { id: invitationId } }),
    prisma.team.findUniqueOrThrow({ where: { id: teamId } }),
  ]);
  if (invitation.status !== "ACCEPTEE") throw new Error("L'invitation doit être acceptée avant de créer un match.");
  if (!invitation.categories.includes(team.category)) throw new Error("Cette équipe n'est pas dans les catégories visées par l'invitation.");
  if (user.role !== "ADMIN" && !canManageCategory(user, team.category)) throw new Error("Accès refusé.");

  const match = await prisma.match.create({ data: matchDataFromInvitation(invitation, team) });
  await logActivity({
    actorId: user.id,
    summary: `a créé le match ${team.code} vs ${invitation.organizingClub} depuis une invitation de tournoi`,
    entityType: "Match",
    entityId: match.id,
  });
  revalidatePath("/tournois");
  revalidatePath("/matchs");
  redirect(`/matchs/${match.id}`);
}

export async function deleteInvitation(invitationId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  const matchCount = await prisma.match.count({ where: { tournamentInvitationId: invitationId } });
  if (matchCount > 0) throw new Error("Impossible de supprimer : un ou plusieurs matchs ont déjà été créés depuis cette invitation.");
  const invitation = await prisma.tournamentInvitation.delete({ where: { id: invitationId } });
  await logActivity({
    actorId: user.id,
    summary: `a supprimé l'invitation de tournoi de ${invitation.organizingClub}`,
    entityType: "TournamentInvitation",
  });
  revalidatePath("/tournois");
}
