"use client";

import { setActiveCategory } from "@/app/(app)/actions";
import type { CategorySwitcherGroup } from "@/lib/authz";

// Only rendered when the user has more than one group (Sidebar.tsx hides
// it otherwise) — auto-submits on change so picking a group doesn't need a
// separate confirm step. Each option's value is the group's key (e.g.
// "U8+U9" for a bundled Responsable perimeter, "U12" for a solo Coach
// category) — see buildCategorySwitcherGroups in src/lib/authz.ts.
export function CategorySwitcher({ groups, activeKey }: { groups: CategorySwitcherGroup[]; activeKey: string }) {
  return (
    <form action={setActiveCategory}>
      <select
        name="category"
        defaultValue={activeKey}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="bg-transparent text-white font-bold text-xs tracking-[0.04em] border-none outline-none cursor-pointer -ml-0.5"
      >
        {groups.map((g) => (
          <option key={g.key} value={g.key} className="text-ink bg-surface">
            {g.label}
          </option>
        ))}
      </select>
    </form>
  );
}
