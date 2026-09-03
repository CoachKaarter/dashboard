"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";

export type ExpectationRow = {
  id: string; // playerId
  firstName: string;
  lastName: string;
  category: string;
  teamCode: string; // groupe habituel — affiché en secondaire seulement (§8)
  expected: boolean;
};

export type ExceptionalCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  teamCode: string;
};

type Filter = "TOUS" | "ATTENDUS" | "NON_ATTENDUS";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "TOUS", label: "Tous" },
  { key: "ATTENDUS", label: "Attendus" },
  { key: "NON_ATTENDUS", label: "Non attendus" },
];

export function ExpectationSection({
  rows,
  candidates,
  sessionTeamCode,
  onSetExpected,
  onSetExpectedBulk,
  onAddExceptional,
}: {
  rows: ExpectationRow[];
  candidates: ExceptionalCandidate[];
  // Code de l'équipe de la séance quand elle est cadrée sur une équipe
  // précise (session.scopeTeam), null pour une séance de catégorie entière
  // (plusieurs équipes réunies). Sert à décider quand "Groupe habituel"
  // apporte une info réelle : jamais pour un joueur de l'équipe de la
  // séance elle-même, toujours en séance de catégorie (aucune équipe
  // "par défaut" là où plusieurs se mélangent).
  sessionTeamCode: string | null;
  onSetExpected: (playerId: string, expected: boolean) => Promise<void>;
  onSetExpectedBulk: (playerIds: string[], expected: boolean) => Promise<void>;
  onAddExceptional: (playerId: string) => Promise<void>;
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [prevRows, setPrevRows] = useState(rows);
  const [filter, setFilter] = useState<Filter>("TOUS");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (rows !== prevRows) {
    setPrevRows(rows);
    setLocalRows(rows);
    setSelected(new Set());
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function toggle(playerId: string, expected: boolean) {
    setLocalRows((rs) => rs.map((r) => (r.id === playerId ? { ...r, expected } : r)));
    setSavingIds((s) => new Set(s).add(playerId));
    try {
      await onSetExpected(playerId, expected);
      refresh();
    } catch {
      setLocalRows(rows);
      setErrorMsg("Impossible d'enregistrer. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(playerId);
        return n;
      });
    }
  }

  async function applyBulk(expected: boolean) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkSaving(true);
    setLocalRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, expected } : r)));
    try {
      await onSetExpectedBulk(ids, expected);
      setSelected(new Set());
      refresh();
    } catch {
      setLocalRows(rows);
      setErrorMsg("Impossible d'enregistrer l'action groupée. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setBulkSaving(false);
    }
  }

  async function addExceptional(playerId: string) {
    setSavingIds((s) => new Set(s).add(playerId));
    try {
      await onAddExceptional(playerId);
      refresh();
    } catch {
      setErrorMsg("Impossible d'ajouter ce joueur. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(playerId);
        return n;
      });
    }
  }

  function toggleSelect(playerId: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(playerId)) n.delete(playerId);
      else n.add(playerId);
      return n;
    });
  }

  const expectedCount = localRows.filter((r) => r.expected).length;
  const notExpectedCount = localRows.length - expectedCount;

  let filtered = localRows;
  if (filter === "ATTENDUS") filtered = filtered.filter((r) => r.expected);
  else if (filter === "NON_ATTENDUS") filtered = filtered.filter((r) => !r.expected);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(q));
  }

  return (
    <div className="bg-surface border border-line rounded-lg mt-3.5">
      <div className="px-3.5 py-2.5 border-b border-line flex items-center gap-2.5 flex-wrap">
        <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Effectif attendu</div>
        <div className="text-[12.5px] text-ink-soft">
          {localRows.length} joueur{localRows.length > 1 ? "s" : ""} concerné{localRows.length > 1 ? "s" : ""} · {expectedCount} attendu
          {expectedCount > 1 ? "s" : ""} · {notExpectedCount} non attendu{notExpectedCount > 1 ? "s" : ""}
        </div>
      </div>

      <div className="px-3.5 pt-2.5 flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`h-7 px-2.5 rounded-full text-[11.5px] font-semibold border transition-colors duration-150 ${
              filter === f.key ? "bg-ink text-white border-ink" : "bg-surface border-line text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un joueur…"
          className="h-7 w-48 px-2.5 border border-line rounded-md text-[11.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
        />
        <span className="flex-1" />
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 animate-fadein">
            <span className="text-[11.5px] text-muted">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() => applyBulk(true)}
              className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-green bg-green-bg text-green hover:brightness-95 disabled:opacity-50"
            >
              Marquer attendus
            </button>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() => applyBulk(false)}
              className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-line text-muted hover:border-ink hover:text-ink disabled:opacity-50"
            >
              Marquer non attendus
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mx-3.5 mt-2.5 rounded-md border border-red/30 bg-red-bg px-3 py-2 text-[12px] text-red font-medium animate-fadein">
          {errorMsg}
        </div>
      )}

      <div className="mt-2">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[24px_minmax(190px,1fr)_120px_120px] gap-3 items-center px-3.5 h-11 border-b border-line-soft-2 last:border-b-0"
          >
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4" />
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar initials={`${r.firstName[0]}${r.lastName[0]}`} size={26} />
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold truncate">
                  {r.firstName} {r.lastName}
                </div>
                <div className="text-[10.5px] text-muted-2 truncate">
                  {r.category}
                  {sessionTeamCode === null || r.teamCode !== sessionTeamCode ? ` · Groupe habituel : ${r.teamCode}` : ""}
                </div>
              </div>
            </div>
            <div />
            <button
              type="button"
              disabled={savingIds.has(r.id)}
              onClick={() => toggle(r.id, !r.expected)}
              className={`h-7 px-3 rounded-md text-[11.5px] font-bold border transition-colors duration-150 disabled:opacity-50 ${
                r.expected ? "bg-green-bg border-green text-green" : "bg-[#FAFAF8] border-line text-muted"
              }`}
            >
              {r.expected ? "Attendu" : "Non attendu"}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-[12.5px] text-muted-2 py-6">Aucun joueur.</div>}
      </div>

      {candidates.length > 0 && (
        <details className="px-3.5 py-2.5 border-t border-line">
          <summary className="cursor-pointer text-[12px] font-semibold text-muted hover:text-ink select-none">
            + Ajouter un joueur
          </summary>
          <div className="mt-2 flex flex-col gap-1 pb-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={savingIds.has(c.id)}
                onClick={() => addExceptional(c.id)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left hover:bg-bg disabled:opacity-50"
              >
                <Avatar initials={`${c.firstName[0]}${c.lastName[0]}`} size={22} />
                <span className="text-[12px] font-semibold flex-1 truncate">
                  {c.firstName} {c.lastName}
                </span>
                <span className="text-[11px] text-muted">Groupe habituel : {c.teamCode}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
