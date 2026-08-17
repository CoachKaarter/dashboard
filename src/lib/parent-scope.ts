import type { TrainingSession } from "@/generated/prisma/client";
import type { AuthedParent } from "@/lib/parent-session";

/** A parent may only ever act on / view sessions that concern their own child's team/category. */
export function sessionInParentScope(session: TrainingSession, parent: AuthedParent) {
  if (session.scopeTeamId) return session.scopeTeamId === parent.player.teamId;
  return session.category === parent.player.teamCategory;
}
