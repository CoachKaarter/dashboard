"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ExceptionalCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  teamCode: string;
};

// Joueur qui vient finalement, hors du groupe initial (§25 du brief V6) —
// le passe ATTENDU pour CETTE séance uniquement, ne touche jamais son
// équipe/groupe habituel.
export function AddExceptionalPlayer({
  candidates,
  onAdd,
}: {
  candidates: ExceptionalCandidate[];
  onAdd: (playerId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (candidates.length === 0) return null;

  async function handleAdd(playerId: string) {
    setAddingId(playerId);
    try {
      await onAdd(playerId);
      startTransition(() => router.refresh());
    } catch {
      setErrorMsg("Impossible d'ajouter ce joueur. Réessaie.");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-[13.5px] font-bold text-ink"
      >
        + Ajouter un joueur non prévu
        <span className="text-[#9A9DA3] text-[12px]">{open ? "Réduire" : "Ouvrir"}</span>
      </button>
      {errorMsg && <div className="mt-2 text-[12.5px] text-red font-medium">{errorMsg}</div>}
      {open && (
        <div className="mt-2.5 flex flex-col gap-1.5 animate-fadein">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={addingId === c.id}
              onClick={() => handleAdd(c.id)}
              className="w-full flex items-center justify-between h-11 px-3 rounded-xl border border-[#E7E7E2] text-left disabled:opacity-50"
            >
              <span className="text-[13.5px] font-semibold text-ink">
                {c.firstName} {c.lastName}
              </span>
              <span className="text-[12px] text-[#8A8D93]">{c.teamCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
