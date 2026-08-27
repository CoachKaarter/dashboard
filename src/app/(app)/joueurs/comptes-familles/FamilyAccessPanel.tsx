"use client";

import { useMemo, useState } from "react";
import { sendInvitationBulkAction } from "./actions";
import type { IssueInvitationResult } from "@/lib/parent-invitation";
import type { FamilyAccessStatus } from "@/lib/parent-invitation-status";
import { TeamChip } from "@/components/ui/TeamChip";

type Row = { id: string; name: string; teamCode: string; email: string | null; status: FamilyAccessStatus };

// Un joueur "sent" (invitation déjà envoyée et encore valide) n'est pas
// sélectionnable ici — le renvoyer avant expiration révoquerait un lien que
// le parent a peut-être déjà ouvert sans avoir fini. "expired" redevient
// actionnable : envoyer = renvoyer un lien frais (issueParentInvitation
// gère les deux cas de façon identique).
const ACTIONABLE: FamilyAccessStatus[] = ["ready", "expired"];

const CONCURRENCY = 3;

export function FamilyAccessPanel({ rows }: { rows: Row[] }) {
  const actionableRows = useMemo(() => rows.filter((r) => ACTIONABLE.includes(r.status)), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(actionableRows.map((r) => r.id)));
  const [phase, setPhase] = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<IssueInvitationResult[]>([]);

  const selectedRows = actionableRows.filter((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runSend(ids: string[]) {
    setPhase("running");
    setDone(0);
    setResults([]);
    const queue = [...ids];
    const collected: IssueInvitationResult[] = [];
    let completed = 0;

    async function worker() {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) return;
        const result = await sendInvitationBulkAction(id);
        collected.push(result);
        completed++;
        setDone(completed);
        setResults([...collected]);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()));
    setPhase("done");
  }

  const failedIds = results.filter((r) => !r.ok).map((r) => r.playerId);

  if (actionableRows.length === 0 && phase === "idle") {
    return (
      <div className="bg-surface border border-line rounded-lg p-3.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Envoi des invitations</span>
        </div>
        <div className="text-[12.5px] text-muted">Aucune invitation à envoyer pour l&apos;instant — tout est déjà à jour.</div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="px-3.5 h-[38px] flex items-center gap-2 bg-[#FAFAF8] border-b border-line">
        <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Envoi des invitations</span>
        <span className="text-[11px] text-muted-2">({actionableRows.length})</span>
      </div>

      {phase === "idle" && (
        <>
          <div className="max-h-[360px] overflow-auto">
            {actionableRows.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0 cursor-pointer">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4 accent-ink" />
                <TeamChip code={r.teamCode} />
                <div className="flex-1 min-w-0 text-[12.5px] font-semibold truncate">{r.name}</div>
                <span className="text-[11px] text-muted-2">{r.status === "expired" ? "expirée — sera renvoyée" : "prête"}</span>
              </label>
            ))}
          </div>
          <div className="px-3.5 py-3">
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={() => setPhase("confirm")}
              className="h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] disabled:opacity-60"
            >
              Envoyer les invitations sélectionnées ({selectedRows.length})
            </button>
          </div>
        </>
      )}

      {phase === "confirm" && (
        <div className="px-3.5 py-3.5 flex flex-col gap-3">
          <div className="text-[13px] text-ink-soft">
            <strong>{selectedRows.length}</strong> invitation{selectedRows.length === 1 ? "" : "s"} {selectedRows.length === 1 ? "va" : "vont"} être
            envoyée{selectedRows.length === 1 ? "" : "s"}
            {rows.length - selectedRows.length > 0 ? ` · ${rows.length - selectedRows.length} joueur${rows.length - selectedRows.length === 1 ? "" : "s"} ignoré${rows.length - selectedRows.length === 1 ? "" : "s"} (pas concerné ou déjà à jour)` : ""}.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runSend(selectedRows.map((r) => r.id))}
              className="h-9 px-4 rounded-md bg-green text-white text-[12.5px] font-semibold hover:opacity-90"
            >
              CONFIRMER L&apos;ENVOI
            </button>
            <button type="button" onClick={() => setPhase("idle")} className="h-9 px-4 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
              Annuler
            </button>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="px-3.5 py-3.5 flex flex-col gap-1.5">
          <div className="h-2 bg-line-soft rounded-full overflow-hidden">
            <div className="h-full bg-green transition-all duration-200" style={{ width: `${Math.round((100 * done) / selectedRows.length)}%` }} />
          </div>
          <div className="text-[12px] text-muted">{done} / {selectedRows.length} traitées…</div>
        </div>
      )}

      {phase === "done" && (
        <div className="px-3.5 py-3.5 flex flex-col gap-2.5">
          <div className="text-[12.5px] text-ink-soft">
            {results.filter((r) => r.ok).length} envoyée{results.filter((r) => r.ok).length === 1 ? "" : "s"}
            {failedIds.length > 0 ? ` · ${failedIds.length} erreur${failedIds.length === 1 ? "" : "s"}` : ""}
          </div>
          <div className="flex flex-col gap-1.5 max-h-[360px] overflow-auto">
            {results.map((r) => (
              <div
                key={r.playerId}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] ${r.ok ? "bg-green-bg" : "bg-red-bg"}`}
              >
                <span className={`font-semibold shrink-0 ${r.ok ? "text-green" : "text-red"}`}>{r.ok ? "✓" : "✕"}</span>
                <span className="flex-1 min-w-0 truncate">{r.playerName}</span>
                {!r.ok && <span className="text-red text-[11.5px]">{r.error}</span>}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {failedIds.length > 0 && (
              <button
                type="button"
                onClick={() => runSend(failedIds)}
                className="h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]"
              >
                Réessayer les erreurs ({failedIds.length})
              </button>
            )}
            <button type="button" onClick={() => setPhase("idle")} className="h-9 px-4 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
