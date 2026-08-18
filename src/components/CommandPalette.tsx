"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { id: string; label: string; sub: string; href: string };
type SearchResponse = { players: Result[]; teams: Result[]; matches: Result[]; sessions: Result[] };

const GROUPS: { key: keyof SearchResponse; title: string }[] = [
  { key: "players", title: "Joueurs" },
  { key: "teams", title: "Équipes" },
  { key: "matches", title: "Matchs" },
  { key: "sessions", title: "Séances" },
];

// Mount this component only while the palette should be visible (e.g.
// `{open && <CommandPalette .../>}`) — a fresh mount is how its query/results
// state resets, instead of an effect resetting state on an `open` prop flip.
export function CommandPalette({ onClose, initialQuery = "" }: { onClose: () => void; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then(setResults)
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  const flat = trimmed.length >= 2 && results ? GROUPS.flatMap((g) => results[g.key].map((r) => ({ ...r, group: g.title }))) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/25 animate-fadein"
      style={{ animationDuration: "0.12s" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-surface border border-line rounded-lg shadow-2xl overflow-hidden animate-scalein"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3.5 h-12 border-b border-line-soft">
          <span className="text-muted-2 text-sm">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un joueur, une équipe, un match, une séance…"
            className="flex-1 h-full outline-none text-[13.5px] bg-transparent"
          />
          <kbd className="text-[10px] text-muted-2 border border-line rounded px-1.5 py-0.5">Échap</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted-2">Tape au moins 2 caractères…</div>
          ) : flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted-2">Aucun résultat pour « {query} ».</div>
          ) : (
            GROUPS.map((g) => {
              const items = results?.[g.key] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={g.key} className="py-1.5">
                  <div className="px-3.5 py-1 text-[10px] font-bold tracking-[0.08em] uppercase text-muted-2">{g.title}</div>
                  {items.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => go(r.href)}
                      className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#FAFAF8] cursor-pointer transition-colors duration-100"
                    >
                      <span className="text-[12.5px] font-semibold flex-1 truncate">{r.label}</span>
                      <span className="text-[11px] text-muted-2">{r.sub}</span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
