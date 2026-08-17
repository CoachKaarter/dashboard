"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateMenu } from "@/components/CreateMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationBell } from "@/components/NotificationBell";

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Cockpit"],
  [/^\/synthese/, "Synthèse"],
  [/^\/planning/, "Planning"],
  [/^\/equipes\/[^/]+$/, "Fiche équipe"],
  [/^\/equipes/, "Équipes"],
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="no-print h-[52px] shrink-0 bg-surface border-b border-line flex items-center gap-3.5 px-5">
      <div className="font-semibold text-sm tracking-[-0.01em] min-w-[150px]">{title}</div>
      <button
        onClick={() => setPaletteOpen(true)}
        className="flex-1 max-w-[420px] relative h-8 border border-line rounded-md bg-bg pl-[30px] pr-[11px] text-[12.5px] text-left text-muted-2 hover:border-ink cursor-pointer"
      >
        <span className="absolute left-2.5 top-2 text-xs text-muted-2">⌕</span>
        Rechercher un joueur, une équipe, un match…
        <kbd className="absolute right-2 top-1.5 text-[10px] text-muted-2 border border-line rounded px-1 py-0.5">⌘K</kbd>
      </button>
      <div className="flex-1" />
      <div className="font-mono text-[11px] text-muted tracking-[0.04em]">{todayLabel}</div>
      <NotificationBell />
      <CreateMenu />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </header>
  );
}
