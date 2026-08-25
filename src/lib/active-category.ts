import { cookies } from "next/headers";
import { getAccessibleCategories, type AuthedUser } from "@/lib/authz";

export const ACTIVE_CATEGORY_COOKIE = "activeCategory";

/**
 * The category currently "in focus" for this browser — distinct from
 * permissions (StaffAccess grants): a Responsable/Coach of several
 * categories works one at a time so screens never mix e.g. U12 matches
 * with U8 ones (see the sidebar switcher, CategorySwitcher.tsx). Falls
 * back to the user's first accessible category (alphabetical) when unset
 * or when the cookie names a category they no longer have access to.
 * Returns null only when the user has zero accessible categories.
 */
export async function getActiveCategory(user: AuthedUser): Promise<string | null> {
  const accessible = getAccessibleCategories(user).sort();
  if (accessible.length === 0) return null;
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_CATEGORY_COOKIE)?.value;
  if (cookieValue && accessible.includes(cookieValue)) return cookieValue;
  return accessible[0];
}
