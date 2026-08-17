import { parentAuth } from "@/parent-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type AuthedParent = {
  parentAccountId: string;
  username: string;
  playerId: string;
  mustChangePassword: boolean;
  player: { firstName: string; lastName: string; teamId: string };
};

/**
 * Always re-reads ParentAccount from the database — the JWT only proves
 * "this browser once authenticated as account X", never "X is still
 * active" or "X's playerId is still Y". A deactivated account or a
 * corrected player link must take effect on the very next request, exactly
 * like requireUser() does for staff in src/lib/authz.ts.
 */
export async function getAuthedParent(): Promise<AuthedParent | null> {
  const session = await parentAuth();
  const raw = session?.user as { id?: string } | undefined;
  if (!raw?.id) return null;

  const account = await prisma.parentAccount.findUnique({
    where: { id: raw.id },
    include: { player: { select: { firstName: true, lastName: true, teamId: true } } },
  });
  if (!account || !account.active) return null;

  return {
    parentAccountId: account.id,
    username: account.username,
    playerId: account.playerId,
    mustChangePassword: account.mustChangePassword,
    player: account.player,
  };
}

export async function requireParent(): Promise<AuthedParent> {
  const parent = await getAuthedParent();
  if (!parent) redirect("/parent/login");
  return parent;
}
