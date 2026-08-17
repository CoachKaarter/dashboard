/**
 * Central authorization helper. The JWT session only carries id/role/jobTitle
 * for cheap display; every real permission decision re-reads the User row so
 * that a deactivated account or a changed team assignment takes effect on
 * the very next request, not at next login.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type AuthedUser = {
  id: string;
  username: string;
  name: string;
  role: string; // "ADMIN" | "COACH" | "STAFF"
  jobTitle: string;
  teamIds: string[]; // ignored for ADMIN, who always has full access
};

export async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    jobTitle: user.jobTitle,
    teamIds: user.teamIds,
  };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** "ALL" for ADMIN, otherwise the explicit list of authorized Team ids (may be empty). */
export function scopedTeamIds(user: AuthedUser): string[] | "ALL" {
  return user.role === "ADMIN" ? "ALL" : user.teamIds;
}

/** Prisma `where` fragment restricting rows to the user's authorized teams via `field`. */
export function teamScopeWhere(user: AuthedUser, field = "teamId") {
  const scope = scopedTeamIds(user);
  return scope === "ALL" ? {} : { [field]: { in: scope } };
}

export function canAccessTeam(user: AuthedUser, teamId: string) {
  const scope = scopedTeamIds(user);
  return scope === "ALL" || scope.includes(teamId);
}
