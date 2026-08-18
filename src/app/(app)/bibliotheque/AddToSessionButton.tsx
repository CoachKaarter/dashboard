"use client";

import { useState, useTransition } from "react";
import { listAddableSessions, addLibraryItemToSession } from "@/app/(app)/seances/[id]/blocks-actions";

export function AddToSessionButton({ contentItemId }: { contentItemId: string }) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; label: string }[] | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!sessions) {
      startTransition(async () => {
        const result = await listAddableSessions();
        setSessions(result);
      });
    }
  }

  function pick(sessionId: string) {
    startTransition(async () => {
      await addLibraryItemToSession(sessionId, contentItemId);
      setOpen(false);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className="h-8 px-3 border-none rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36] flex items-center gap-1.5"
      >
        Ajouter à une séance
      </button>
      {done && <span className="ml-2 text-[11px] font-semibold text-green">✓ Ajouté à la séance</span>}
      {open && (
        <div className="absolute z-20 top-9 left-0 w-[280px] bg-surface border border-line rounded-lg shadow-lg py-1.5 max-h-[320px] overflow-y-auto">
          {pending && !sessions && <div className="px-3 py-2 text-[12px] text-muted">Chargement…</div>}
          {sessions?.length === 0 && <div className="px-3 py-2 text-[12px] text-muted">Aucune séance accessible dans les 3 prochaines semaines.</div>}
          {sessions?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s.id)}
              className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-bg flex items-center justify-between gap-2"
            >
              <span className="capitalize">{s.label}</span>
              <span className="text-muted-2 text-[11px]">Ajouter</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
