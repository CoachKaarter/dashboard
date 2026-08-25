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
    teamIds: await effectiveTeamScope(user.role, user.teamIds),
  };
}

/**
 * A coach isn't administratively attached to a fixed team anymore in any way
 * that limits what they can see: a player belongs to a category (U12/U13),
 * not a specific team, so a coach nominally assigned to one team (User.teamIds,
 * still the raw admin assignment edited on /staff) must see and manage every
 * team in that team's category, not just the exact one. Expanding it once
 * here — rather than in scopedTeamIds()/teamScopeWhere()/canAccessTeam() — means
 * every one of their ~40 call sites across the app gets category-wide scope
 * for free, with no per-call-site change needed.
 */
export function expandScopeToCategories(assignedTeamIds: string[], allTeams: { id: string; category: string }[]): string[] {
  const categories = new Set(allTeams.filter((t) => assignedTeamIds.includes(t.id)).map((t) => t.category));
  if (categories.size === 0) return assignedTeamIds;
  return allTeams.filter((t) => categories.has(t.category)).map((t) => t.id);
}

async function effectiveTeamScope(role: string, rawTeamIds: string[]): Promise<string[]> {
  if (role === "ADMIN" || rawTeamIds.length === 0) return rawTeamIds;
  const allTeams = await prisma.team.findMany({ select: { id: true, category: true } });
  return expandScopeToCategories(rawTeamIds, allTeams);
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

/**
 * TrainingSession targets either one specific team (scopeTeamId set) or an
 * entire category (U12/U13). For the category-wide case, access requires the
 * user to be authorized for at least one team in that category.
 */
export async function canAccessSession(
  user: AuthedUser,
  session: { scopeTeamId: string | null; category: string }
) {
  const scope = scopedTeamIds(user);
  if (scope === "ALL") return true;
  if (session.scopeTeamId) return scope.includes(session.scopeTeamId);
  const count = await prisma.team.count({ where: { id: { in: scope }, category: session.category } });
  return count > 0;
}
