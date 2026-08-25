"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser, buildCategorySwitcherGroups } from "@/lib/authz";
import { ACTIVE_CATEGORY_COOKIE } from "@/lib/active-category";

// Never trust the submitted value on its own — a user could otherwise
// switch their "active category" cookie to a group key they have no real
// StaffAccess grant for. It's only a view preference, not itself a
// permission check (every screen still scopes its queries independently),
// but showing data for a category they can't actually access would be a
// confusing leak.
export async function setActiveCategory(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("category") ?? "");
  const groups = buildCategorySwitcherGroups(user);
  if (!groups.some((g) => g.key === key)) return;

  const store = await cookies();
  store.set(ACTIVE_CATEGORY_COOKIE, key, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
