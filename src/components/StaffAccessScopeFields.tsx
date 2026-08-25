"use client";

import { useState } from "react";

const selectClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

// The "périmètre" a responsibility applies to — a single team, a whole
// category, or every category of the école de foot (Settings.
// schoolFootballCategories) — needs a different follow-up field each time,
// so this stays a small client component purely for that show/hide.
export function StaffAccessScopeFields({ teams }: { teams: { id: string; code: string; category: string }[] }) {
  const [scope, setScope] = useState<"TEAM" | "CATEGORY" | "SCHOOL">("CATEGORY");
  const categories = [...new Set(teams.map((t) => t.category))].sort();

  return (
    <>
      <select name="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={selectClass}>
        <option value="CATEGORY">Catégorie entière</option>
        <option value="TEAM">Équipe précise</option>
        <option value="SCHOOL">École de foot (toutes catégories)</option>
      </select>
      {scope === "TEAM" && (
        <select name="teamId" required className={selectClass}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code}
            </option>
          ))}
        </select>
      )}
      {scope === "CATEGORY" && (
        <select name="category" required className={selectClass}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
