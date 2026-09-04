import { prisma } from "@/lib/prisma";

export async function notify(userId: string, data: { type: string; title: string; body?: string; href?: string }) {
  await prisma.notification.create({
    data: { userId, type: data.type, title: data.title, body: data.body ?? null, href: data.href ?? null },
  });
}

/** Notifies every active staff member with access to the given team (ADMIN + anyone whose teamIds includes it). */
export async function notifyTeamStaff(teamId: string, data: { type: string; title: string; body?: string; href?: string }, excludeUserId?: string) {
  const staff = await prisma.user.findMany({
    where: { active: true, OR: [{ role: "ADMIN" }, { teamIds: { has: teamId } }] },
  });
  await Promise.all(
    staff.filter((s) => s.id !== excludeUserId).map((s) => notify(s.id, data))
  );
}

/**
 * Same as notifyTeamStaff, for a player with no fixed team (Player.teamId
 * null) — notifies ADMIN + anyone whose teamIds includes ANY team of the
 * player's category, since there's no single team to check against.
 */
export async function notifyCategoryStaff(category: string, data: { type: string; title: string; body?: string; href?: string }, excludeUserId?: string) {
  const categoryTeamIds = (await prisma.team.findMany({ where: { category }, select: { id: true } })).map((t) => t.id);
  const staff = await prisma.user.findMany({
    where: { active: true, OR: [{ role: "ADMIN" }, { teamIds: { hasSome: categoryTeamIds } }] },
  });
  await Promise.all(
    staff.filter((s) => s.id !== excludeUserId).map((s) => notify(s.id, data))
  );
}
