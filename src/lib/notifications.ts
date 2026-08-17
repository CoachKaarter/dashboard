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
