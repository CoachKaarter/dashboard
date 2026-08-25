import { cookies } from "next/headers";
import { buildCategorySwitcherGroups, type AuthedUser, type CategorySwitcherGroup } from "@/lib/authz";

export const ACTIVE_CATEGORY_COOKIE = "activeCategory";

/**
 * The category group currently "in focus" for this browser — distinct from
 * permissions (StaffAccess grants): a Responsable/Coach of several
 * categories works one group at a time so screens never mix e.g. U12
 * matches with U8 ones (see the sidebar switcher, CategorySwitcher.tsx).
 * Falls back to the user's first group when unset or when the cookie names
 * a group that no longer matches their access. Returns null only when the
 * user has zero accessible categories.
 */
export async function getActiveCategoryGroup(user: AuthedUser): Promise<CategorySwitcherGroup | null> {
  const groups = buildCategorySwitcherGroups(user);
  if (groups.length === 0) return null;
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_CATEGORY_COOKIE)?.value;
  return groups.find((g) => g.key === cookieValue) ?? groups[0];
}
