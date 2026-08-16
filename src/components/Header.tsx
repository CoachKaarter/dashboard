"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CreateMenu } from "@/components/CreateMenu";

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Cockpit"],
  [/^\/planning/, "Planning"],
  [/^\/joueurs\/[^/]+$/, "Fiche joueur"],
  [/^\/joueurs/, "Joueurs"],
  [/^\/seances\/nouvelle/, "Nouvelle séance"],
  [/^\/seances\/[^/]+$/, "Détail séance"],
  [/^\/seances/, "Séances"],
  [/^\/matchs\/nouveau/, "Nouveau match"],
  [/^\/matchs\/[^/]+$/, "Fiche match"],
  [/^\/matchs/, "Matchs"],
  [/^\/temps-de-jeu/, "Temps de jeu"],
  [/^\/evaluations/, "Évaluations"],
  [/^\/alertes/, "Alertes"],
  [/^\/materiel/, "Matériel"],
  [/^\/staff/, "Staff"],
  [/^\/parametres/, "Paramètres"],
];

export function Header({ todayLabel }: { todayLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "";

  return (
    <header className="h-[52px] shrink-0 bg-surface border-b border-line flex items-center gap-3.5 px-5">
      <div className="font-semibold text-sm tracking-[-0.01em] min-w-[150px]">{title}</div>
      <form
        className="flex-1 max-w-[420px] relative"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) router.push(`/joueurs?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un joueur, une équipe, un match…"
          className="w-full h-8 border border-line rounded-md bg-bg pl-[30px] pr-[11px] text-[12.5px] outline-none focus:border-blue focus:bg-surface focus:ring-[3px] focus:ring-blue-bg"
        />
        <span className="absolute left-2.5 top-2 text-xs text-muted-2">⌕</span>
      </form>
      <div className="flex-1" />
      <div className="font-mono text-[11px] text-muted tracking-[0.04em]">{todayLabel}</div>
      <CreateMenu />
    </header>
  );
}
