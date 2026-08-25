"use client";

import { setActiveCategory } from "@/app/(app)/actions";

// Only rendered when the user manages more than one category (Sidebar.tsx
// hides it otherwise) — auto-submits on change so picking a category
// doesn't need a separate confirm step.
export function CategorySwitcher({ categories, active }: { categories: string[]; active: string }) {
  return (
    <form action={setActiveCategory}>
      <select
        name="category"
        defaultValue={active}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="bg-transparent text-white font-bold text-xs tracking-[0.04em] border-none outline-none cursor-pointer -ml-0.5"
      >
        {categories.map((c) => (
          <option key={c} value={c} className="text-ink bg-surface">
            {c}
          </option>
        ))}
      </select>
    </form>
  );
}
