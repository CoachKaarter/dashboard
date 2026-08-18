"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AttendancePlayerRow } from "./AttendancePlayerRow";
import { AttendanceSummary } from "./AttendanceSummary";
import { SearchIcon, AlertIcon } from "./icons";
import { useWakeLock } from "@/lib/useWakeLock";

export type BoardPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  code: string | null;
  note: string | null;
  delayMinutes: number | null;
  familyStatus: "AVAILABLE" | "UNAVAILABLE" | null;
  familyReason: string | null;
};

type Filter = "TOUS" | "A_POINTER" | "PRESENTS" | "ABSENTS" | "RETARDS";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "TOUS", label: "Tous" },
  { key: "A_POINTER", label: "À pointer" },
  { key: "PRESENTS", label: "Présents" },
  { key: "ABSENTS", label: "Absents" },
  { key: "RETARDS", label: "Retards" },
];

export function AttendanceBoard({
  players,
  onSetAttendance,
  onSetNote,
  onMarkAllPresent,
}: {
  players: BoardPlayer[];
  onSetAttendance: (playerId: string, code: string) => Promise<void>;
  onSetNote: (playerId: string, formData: FormData) => Promise<void>;
  onMarkAllPresent: () => Promise<void>;
}) {
  const [prevPlayers, setPrevPlayers] = useState(players);
  const [rows, setRows] = useState(players);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("TOUS");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();
  useWakeLock(true);

  // Reconciles with the server's truth after every refresh — including
  // changes made concurrently by a second coach pointing the same session.
  // Adjusting state during render (React's documented pattern for this,
  // rather than an effect) avoids an extra cascading render.
  if (players !== prevPlayers) {
    setPrevPlayers(players);
    setRows(players);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleSetCode(playerId: string, code: string) {
    const previous = rows.find((r) => r.id === playerId)?.code ?? null;
    setRows((rs) => rs.map((r) => (r.id === playerId ? { ...r, code: previous === code ? null : code } : r)));
    setSavingIds((s) => new Set(s).add(playerId));
    try {
      await onSetAttendance(playerId, code);
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(playerId);
        return n;
      });
      setSavedIds((s) => new Set(s).add(playerId));
      setTimeout(() => setSavedIds((s) => {
        const n = new Set(s);
        n.delete(playerId);
        return n;
      }), 1600);
      refresh();
    } catch {
      // Never lose the action silently (§55) — revert and surface it.
      setRows((rs) => rs.map((r) => (r.id === playerId ? { ...r, code: previous } : r)));
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(playerId);
        return n;
      });
      setErrorMsg("Impossible d'enregistrer. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    }
  }

  async function handleSetNote(playerId: string, note: string) {
    setRows((rs) => rs.map((r) => (r.id === playerId ? { ...r, note } : r)));
    const fd = new FormData();
    fd.set("note", note);
    try {
      await onSetNote(playerId, fd);
      refresh();
    } catch {
      setErrorMsg("Impossible d'enregistrer la note. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    }
  }

  async function handleMarkAllPresent() {
    try {
      await onMarkAllPresent();
      refresh();
    } catch {
      setErrorMsg("Impossible d'enregistrer. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    }
  }

  const counts = { P: 0, R: 0, AJ: 0, ANJ: 0, B: 0 };
  for (const r of rows) if (r.code) counts[r.code as keyof typeof counts]++;

  const anomalies = rows.filter(
    (r) => (r.familyStatus === "UNAVAILABLE" && r.code === "P") || (r.familyStatus === "AVAILABLE" && r.code === "ANJ")
  );

  let filtered = rows;
  if (filter === "A_POINTER") filtered = rows.filter((r) => !r.code);
  else if (filter === "PRESENTS") filtered = rows.filter((r) => r.code === "P");
  else if (filter === "ABSENTS") filtered = rows.filter((r) => r.code === "AJ" || r.code === "ANJ");
  else if (filter === "RETARDS") filtered = rows.filter((r) => r.code === "R");
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(q));
  }

  const toPoint = rows.filter((r) => !r.code).length;

  return (
    <div className="flex flex-col gap-3.5">
      <AttendanceSummary counts={counts} total={rows.length} />

      {errorMsg && (
        <div className="rounded-xl border border-red/30 bg-red-bg px-3.5 py-2.5 text-[13px] text-red font-medium animate-fadein">
          {errorMsg}
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 animate-slidedown">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase text-orange">
            <AlertIcon size={13} /> À vérifier
          </div>
          <div className="flex flex-col gap-1 mt-1.5">
            {anomalies.map((a) => (
              <div key={a.id} className="text-[12.5px] text-[#6E7178]">
                <span className="font-semibold text-ink">{a.firstName}</span>{" "}
                {a.familyStatus === "UNAVAILABLE" ? "annoncé absent mais marqué présent" : "annoncé disponible mais marqué ANJ"}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleMarkAllPresent}
        disabled={toPoint === 0}
        className="h-12 rounded-xl bg-green-bg text-green border-2 border-green text-[14.5px] font-bold active:scale-[0.98] transition-transform duration-100 disabled:opacity-40"
      >
        Tout marquer présent
      </button>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`h-9 px-3.5 rounded-full text-[12.5px] font-semibold border shrink-0 transition-all duration-150 ${
              filter === f.key ? "bg-ink text-white border-ink" : "bg-white border-[#E7E7E2] text-[#6E7178]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {players.length > 12 && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9DA3]">
            <SearchIcon size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un joueur…"
            className="h-11 w-full pl-9 pr-3 border border-[#E7E7E2] rounded-xl text-[13.5px] bg-white outline-none focus:border-blue"
          />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((r) => (
          <AttendancePlayerRow
            key={r.id}
            firstName={r.firstName}
            lastName={r.lastName}
            code={r.code}
            note={r.note}
            saving={savingIds.has(r.id)}
            justSaved={savedIds.has(r.id)}
            delayMinutes={r.delayMinutes}
            familyStatus={r.familyStatus}
            familyReason={r.familyReason}
            onSetCode={(code) => handleSetCode(r.id, code)}
            onSetNote={(note) => handleSetNote(r.id, note)}
          />
        ))}
        {filtered.length === 0 && <div className="text-center text-[13px] text-[#9A9DA3] py-6">Aucun joueur.</div>}
      </div>
    </div>
  );
}
