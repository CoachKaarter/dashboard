"use client";

import { useState, useTransition } from "react";
import { listAddableSessions, duplicateSessionContent } from "./blocks-actions";

export function DuplicateSessionButton({ sessionId }: { sessionId: string }) {
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
        setSessions(await listAddableSessions(sessionId));
      });
    }
  }

  function pick(targetSessionId: string) {
    startTransition(async () => {
      await duplicateSessionContent(sessionId, targetSessionId);
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
        className="h-9 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink"
      >
        Dupliquer le contenu vers…
      </button>
      {done && <span className="ml-2 text-[11px] font-semibold text-green">✓ Contenu dupliqué</span>}
      {open && (
        <div className="absolute z-20 top-10 left-0 w-[300px] bg-surface border border-line rounded-lg shadow-lg py-1.5 max-h-[320px] overflow-y-auto">
          {pending && !sessions && <div className="px-3 py-2 text-[12px] text-muted">Chargement…</div>}
          {sessions?.length === 0 && <div className="px-3 py-2 text-[12px] text-muted">Aucune autre séance accessible dans les 3 prochaines semaines.</div>}
          {sessions?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s.id)}
              className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-bg flex items-center justify-between gap-2"
            >
              <span className="capitalize">{s.label}</span>
              <span className="text-muted-2 text-[11px]">Copier ici</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
