"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { previewPlayerImport, confirmPlayerImport, type PlayerImportPreviewState } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export function ImportPreviewClient({ teams }: { teams: { id: string; code: string }[] }) {
  const [state, formAction] = useActionState<PlayerImportPreviewState, FormData>(previewPlayerImport, null);

  if (!state || "error" in state) {
    return (
      <form action={formAction} className="flex flex-col gap-3.5">
        {state?.error && <div className="px-3 py-2 rounded-md bg-red-bg text-red text-[12.5px] font-medium">{state.error}</div>}
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">
            Équipe par défaut (si le fichier n&apos;a pas de colonne Équipe)
          </span>
          <select name="teamId" defaultValue="" className={inputClass}>
            <option value="">— Aucune (fichier avec colonne Équipe) —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}
              </option>
            ))}
          </select>
        </label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,.xlsx"
          required
          className="text-[12.5px] file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-line file:bg-[#FCFCFB] file:text-xs file:font-semibold file:cursor-pointer"
        />
        <SubmitButton
          pendingLabel="Analyse…"
          className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer hover:bg-[#2A2E36]"
        >
          Analyser le fichier
        </SubmitButton>
      </form>
    );
  }

  const validCount = state.rows.filter((r) => r.ok).length;
  const errorCount = state.rows.length - validCount;

  return (
    <form action={confirmPlayerImport} className="flex flex-col gap-3">
      <input type="hidden" name="rows" value={JSON.stringify(state.rows)} />
      <div className="text-[12.5px] text-muted">
        {validCount} ligne{validCount > 1 ? "s" : ""} prête{validCount > 1 ? "s" : ""} à importer
        {errorCount > 0 ? ` · ${errorCount} ignorée${errorCount > 1 ? "s" : ""} (erreur)` : ""}. Décochez celles à exclure —
        les doublons potentiels sont décochés par défaut.
      </div>
      <div className="border border-line rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
        {state.rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-3 h-10 border-b border-line-soft-2 last:border-b-0 text-[12.5px] ${!r.ok ? "opacity-60" : ""}`}
          >
            {r.ok ? (
              <input type="checkbox" name="include" value={i} defaultChecked={!r.duplicate} className="shrink-0" />
            ) : (
              <span className="w-[13px] shrink-0 text-center text-red">✕</span>
            )}
            <span className="font-mono text-muted-2 w-8 shrink-0">L{r.sourceRow}</span>
            {r.ok ? (
              <>
                <span className="font-semibold flex-1 min-w-0 truncate">
                  {r.firstName} {r.lastName}
                </span>
                <span className="text-ink-soft w-14 shrink-0">{r.teamCode}</span>
                <span className="font-mono text-muted-2 w-12 shrink-0">{r.birthYear}</span>
                {r.duplicate && <span className="text-orange text-[10.5px] font-semibold shrink-0 w-24 text-right">Déjà présent</span>}
              </>
            ) : (
              <span className="text-red flex-1 min-w-0 truncate">{r.error}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <SubmitButton
          pendingLabel="Import…"
          className="h-10 flex-1 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer hover:bg-[#2A2E36]"
        >
          Confirmer l&apos;import
        </SubmitButton>
        <button
          type="button"
          // A hard reload, not next/link — this needs to fully remount the
          // component so useActionState's preview state actually clears;
          // a soft client-side nav back to the exact same URL wouldn't.
          onClick={() => window.location.reload()}
          className="h-10 px-4 flex items-center border border-line rounded-md text-[13px] font-semibold text-ink-soft hover:border-ink"
        >
          Recommencer
        </button>
      </div>
    </form>
  );
}
