/**
 * Central authorization helper. The JWT session only carries id/role/jobTitle
 * for cheap display; every real permission decision re-reads the User row so
 * that a deactivated account or a changed grant takes effect on the very
 * next request, not at next login.
 *
 * Two separate things are deliberately kept apart (staff permissions pass,
 * see StaffAccess in prisma/schema.prisma):
 *  - `role` is a TECHNICAL role (ADMIN/COACH/STAFF) — it gates staff CRUD,
 *    club branding, paramètres. It no longer implies anything about which
 *    players/séances/matchs a user can see.
 *  - sporting access — which teams/categories a user can operate on, and at
 *    what level (COACH day-to-day vs RESPONSABLE full pilotage) — comes
 *    entirely from that user's StaffAccess grants, cumulative. An ADMIN with
 *    zero grants sees zero sporting data, same as anyone else.
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";
import { decideOnboardingRedirect } from "@/lib/redirect-policy";

export type AccessLevel = "COACH" | "RESPONSABLE";

export type TeamRef = { id: string; code: string; category: string };

export type RawGrant = {
  level: AccessLevel;
  scope: "TEAM" | "CATEGORY" | "SCHOOL";
  category: string | null;
  teamId: string | null;
};

export type AccessibleScope =
  | { kind: "category"; category: string; level: AccessLevel }
  | { kind: "team"; teamId: string; teamCode: string; category: string; level: AccessLevel };

export type AuthedUser = {
  id: string;
  username: string;
  name: string;
  role: string; // "ADMIN" | "COACH" | "STAFF" — technical role, see module doc
  jobTitle: string;
  onboardingCompletedAt: Date | null;
  teamIds: string[]; // effective, fully-expanded team ids — ignored when hasFullAccess
  hasFullAccess: boolean; // true only if teamIds provably covers every team that currently exists
  scopes: AccessibleScope[]; // granular grants, for building per-user filter UIs
};

// ---------- Pure, unit-tested grant → scope → team-id expansion ----------

/**
 * Turns raw StaffAccess rows into display-friendly scopes: a CATEGORY grant
 * stays a category ("U8"), a TEAM grant stays that one team ("U12A") — no
 * expansion here, that's expandScopesToTeamIds()'s job. A SCHOOL grant
 * expands into one category-scope per entry of `schoolCategories` (the
 * club's configured "école de foot" perimeter — Settings.schoolFootballCategories),
 * so redefining that list in Paramètres immediately reshapes every
 * Responsable-école-de-foot grant without touching the grants themselves.
 * When the same team/category is reachable through more than one grant
 * (e.g. a CATEGORY RESPONSABLE grant and a TEAM COACH grant on a team of
 * that category), the higher level wins.
 */
export function buildAccessibleScopes(grants: RawGrant[], allTeams: TeamRef[], schoolCategories: string[]): AccessibleScope[] {
  const byTeamId = new Map(allTeams.map((t) => [t.id, t]));
  const raw: AccessibleScope[] = [];
  for (const g of grants) {
    if (g.scope === "TEAM" && g.teamId) {
      const t = byTeamId.get(g.teamId);
      if (t) raw.push({ kind: "team", teamId: t.id, teamCode: t.code, category: t.category, level: g.level });
    } else if (g.scope === "CATEGORY" && g.category) {
      raw.push({ kind: "category", category: g.category, level: g.level });
    } else if (g.scope === "SCHOOL") {
      for (const category of schoolCategories) raw.push({ kind: "category", category, level: g.level });
    }
  }

  const keyOf = (s: AccessibleScope) => (s.kind === "category" ? `category:${s.category}` : `team:${s.teamId}`);
  const byKey = new Map<string, AccessibleScope>();
  for (const s of raw) {
    const existing = byKey.get(keyOf(s));
    if (!existing || (existing.level === "COACH" && s.level === "RESPONSABLE")) byKey.set(keyOf(s), s);
  }
  return [...byKey.values()];
}

/** Fully expands scopes into concrete team ids — a category-scope pulls in every team of that category. */
export function expandScopesToTeamIds(scopes: AccessibleScope[], allTeams: TeamRef[]): string[] {
  const ids = new Set<string>();
  for (const s of scopes) {
    if (s.kind === "team") ids.add(s.teamId);
    else for (const t of allTeams) if (t.category === s.category) ids.add(t.id);
  }
  return [...ids];
}

// ---------- Session → AuthedUser ----------

export async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { staffAccess: true },
  });
  if (!user || !user.active) return null;

  const [allTeams, settings] = await Promise.all([
    prisma.team.findMany({ select: { id: true, code: true, category: true } }),
    getSettings(),
  ]);

  const grants: RawGrant[] = user.staffAccess.map((g) => ({
    level: g.level as AccessLevel,
    scope: g.scope as RawGrant["scope"],
    category: g.category,
    teamId: g.teamId,
  }));
  const scopes = buildAccessibleScopes(grants, allTeams, settings.schoolFootballCategories);
  const teamIds = expandScopesToTeamIds(scopes, allTeams);
  const hasFullAccess = allTeams.length > 0 && teamIds.length === allTeams.length;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    jobTitle: user.jobTitle,
    onboardingCompletedAt: user.onboardingCompletedAt,
    teamIds,
    hasFullAccess,
    scopes,
  };
}

// skipOnboardingCheck exists solely for /onboarding itself — every other
// call site keeps calling requireUser() with no argument, so this doesn't
// touch the ~40 existing call sites across the app.
export async function requireUser(options?: { skipOnboardingCheck?: boolean }): Promise<AuthedUser> {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  if (!options?.skipOnboardingCheck) {
    const target = decideOnboardingRedirect(user.onboardingCompletedAt);
    if (target) redirect(target);
  }
  return user;
}

/** Technical admin gate only — staff CRUD, club branding, paramètres. Never use this to gate sporting data. */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** True for the ADMIN technical role, or anyone with RESPONSABLE-level standing in at least one category. */
export function isResponsableOrAdmin(user: AuthedUser): boolean {
  return user.role === "ADMIN" || user.scopes.some((s) => s.level === "RESPONSABLE");
}

/**
 * Lieux et Modèles de match (§26) sont des réglages globaux, pas cloisonnés
 * par catégorie — un Responsable de N'IMPORTE QUELLE catégorie (ou l'École
 * de foot) a une vue d'ensemble légitime pour les gérer, contrairement aux
 * réglages club (branding, seuils d'alerte) qui restent ADMIN uniquement.
 */
export async function requireResponsableOrAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (!isResponsableOrAdmin(user)) redirect("/");
  return user;
}

/** "ALL" only when the user's grants provably cover every team that exists, otherwise the explicit list (may be empty). */
export function scopedTeamIds(user: AuthedUser): string[] | "ALL" {
  return user.hasFullAccess ? "ALL" : user.teamIds;
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
 * The user's accessible team ids, narrowed to a set of categories — the
 * "active category group" a multi-category Responsable/Coach is currently
 * working in (see src/lib/active-category.ts and buildCategorySwitcherGroups
 * below). Pass `categories: null` to skip the narrowing and get every
 * accessible team, same as scopedTeamIds would (still as a concrete array,
 * never "ALL", since callers use this to build a category-aware `where`
 * directly).
 */
export function scopedTeamIdsInCategory(user: AuthedUser, allTeams: TeamRef[], categories: string[] | null): string[] {
  const scope = scopedTeamIds(user);
  return allTeams
    .filter((t) => (scope === "ALL" || scope.includes(t.id)) && (categories === null || categories.includes(t.category)))
    .map((t) => t.id);
}

export type CategorySwitcherGroup = { key: string; label: string; categories: string[] };

/**
 * Options for the sidebar's active-category switcher. A Responsable runs
 * every category they're Responsable of as ONE combined perimeter (Davy's
 * U8 + U9 → a single "U8/U9" option) — they're the same job, splitting them
 * into separate switcher entries would just add clicks. A category reached
 * only at COACH level stays its own separate option: a Coach's day-to-day
 * is genuinely scoped to that one category (Davy's U12, from coaching one
 * of its teams, stays apart from his U8/U9 pilotage).
 */
export function buildCategorySwitcherGroups(user: AuthedUser): CategorySwitcherGroup[] {
  const responsableCategories = [
    ...new Set(user.scopes.filter((s) => s.kind === "category" && s.level === "RESPONSABLE").map((s) => s.category)),
  ].sort();
  const coachCategories = getAccessibleCategories(user)
    .filter((c) => !responsableCategories.includes(c))
    .sort();

  const groups: CategorySwitcherGroup[] = [];
  if (responsableCategories.length > 0) {
    groups.push({ key: responsableCategories.join("+"), label: responsableCategories.join("/"), categories: responsableCategories });
  }
  for (const c of coachCategories) groups.push({ key: c, label: c, categories: [c] });
  return groups;
}

export function assertTeamAccess(user: AuthedUser, teamId: string) {
  if (!canAccessTeam(user, teamId)) redirect("/");
}

/** Every category the user has at least some standing in — RESPONSABLE/SCHOOL fully, or COACH through a single team of it. */
export function getAccessibleCategories(user: AuthedUser): string[] {
  return [...new Set(user.scopes.map((s) => s.category))];
}

export function canAccessCategory(user: AuthedUser, category: string): boolean {
  return user.scopes.some((s) => s.category === category);
}

export function assertCategoryAccess(user: AuthedUser, category: string) {
  if (!canAccessCategory(user, category)) redirect("/");
}

/** RESPONSABLE-level (or school-wide) coverage of the category — full pilotage, not just a team inside it. */
export function canManageCategory(user: AuthedUser, category: string): boolean {
  return user.scopes.some((s) => s.kind === "category" && s.category === category && s.level === "RESPONSABLE");
}

/**
 * Catégories à proposer dans un formulaire de création (séance, créneau
 * récurrent...) : un ADMIN doit pouvoir démarrer n'importe quelle catégorie
 * du club même sans StaffAccess personnel dessus (même exception que
 * createTeam dans equipes/actions.ts) ; les autres restent limités à
 * getAccessibleCategories.
 */
export async function getManageableCategories(user: AuthedUser): Promise<string[]> {
  if (user.role !== "ADMIN") return getAccessibleCategories(user).sort();
  const rows = await prisma.team.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  return rows.map((t) => t.category);
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
