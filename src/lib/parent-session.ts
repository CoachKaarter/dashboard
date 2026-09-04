import { parentAuth } from "@/parent-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const ACTIVE_CHILD_COOKIE = "parent-active-child";

export type ParentChild = { id: string; firstName: string; lastName: string; teamId: string | null; teamCategory: string };

export type AuthedParent = {
  parentAccountId: string;
  username: string;
  mustChangePassword: boolean;
  onboardingCompletedAt: Date | null;
  // Tous les enfants actifs liés à ce compte (jamais vide — un compte sans
  // enfant actif n'authentifie pas, voir plus bas), triés par prénom pour
  // un ordre d'affichage stable.
  children: ParentChild[];
  // L'enfant actuellement affiché — résolu depuis le cookie
  // ACTIVE_CHILD_COOKIE, ou le premier enfant à défaut. Repris à chaque
  // requête, jamais mis en cache côté client : changer d'enfant (voir
  // setActiveChildAction) prend effet dès la page suivante.
  activePlayerId: string;
  activePlayer: ParentChild;
};

/**
 * Always re-reads ParentAccount from the database — the JWT only proves
 * "this browser once authenticated as account X", never "X is still
 * active" or "which children X currently has". A deactivated account, a
 * newly-linked sibling, or an archived child must take effect on the very
 * next request, exactly like requireUser() does for staff in
 * src/lib/authz.ts.
 */
export async function getAuthedParent(): Promise<AuthedParent | null> {
  const session = await parentAuth();
  const raw = session?.user as { id?: string } | undefined;
  if (!raw?.id) return null;

  const account = await prisma.parentAccount.findUnique({
    where: { id: raw.id },
    include: {
      players: {
        include: { player: { select: { id: true, firstName: true, lastName: true, teamId: true, category: true, archived: true } } },
      },
    },
  });
  if (!account || !account.active) return null;

  const children: ParentChild[] = account.players
    .map((link) => link.player)
    .filter((p) => !p.archived)
    .map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, teamId: p.teamId, teamCategory: p.category }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));

  // Tous les enfants ont quitté le club (archivés) — traité comme un
  // compte désactivé : rien à afficher, la session ne s'établit pas.
  if (children.length === 0) return null;

  const store = await cookies();
  const requested = store.get(ACTIVE_CHILD_COOKIE)?.value;
  const activePlayer = children.find((c) => c.id === requested) ?? children[0];

  return {
    parentAccountId: account.id,
    username: account.username,
    mustChangePassword: account.mustChangePassword,
    onboardingCompletedAt: account.onboardingCompletedAt,
    children,
    activePlayerId: activePlayer.id,
    activePlayer,
  };
}

export async function requireParent(): Promise<AuthedParent> {
  const parent = await getAuthedParent();
  if (!parent) redirect("/parent/login");
  return parent;
}
