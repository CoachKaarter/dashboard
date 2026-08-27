"use client";

import { useState } from "react";
import { deletePlayer } from "@/app/(app)/joueurs/[id]/actions";

/**
 * Irréversible (cascade sur tout l'historique — voir le commentaire au-dessus
 * de deletePlayer côté serveur), donc pas de simple confirm() : il faut
 * retaper le nom exact du joueur pour activer le bouton, en plus du
 * window.confirm() final. deleteError=1 (retour serveur si le nom retapé ne
 * correspondait pas) rouvre directement ce bloc avec le message d'erreur.
 */
export function DeletePlayerButton({ playerId, playerFullName, showError }: { playerId: string; playerFullName: string; showError: boolean }) {
  const [open, setOpen] = useState(showError);
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === playerFullName;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-8 border border-line rounded-md text-xs font-semibold text-muted hover:border-red hover:text-red"
      >
        Supprimer définitivement ce joueur
      </button>
    );
  }

  return (
    <div className="border border-red/30 bg-red-bg rounded-md p-3 flex flex-col gap-2">
      {showError && <div className="text-[11.5px] text-red font-semibold">Le nom retapé ne correspondait pas — rien n&apos;a été supprimé.</div>}
      <div className="text-[11.5px] text-red leading-snug">
        Action irréversible : tout l&apos;historique de {playerFullName} (présences, statistiques, évaluations, convocations…) sera effacé
        avec lui. Pour une absence de club, préfère « Archiver » ci-dessus, qui conserve l&apos;historique.
      </div>
      <div className="text-[11px] text-ink-soft">
        Retape <span className="font-mono font-bold">{playerFullName}</span> pour confirmer :
      </div>
      <form
        action={deletePlayer.bind(null, playerId)}
        onSubmit={(e) => {
          if (!window.confirm(`Confirmer la suppression définitive de ${playerFullName} et de tout son historique ?`)) {
            e.preventDefault();
          }
        }}
        className="flex flex-col gap-1.5"
      >
        <input
          name="confirmName"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={playerFullName}
          className="h-8 border border-line rounded-md px-2.5 text-[12.5px] bg-white outline-none focus:border-red focus:ring-[3px] focus:ring-red/15"
        />
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={!matches}
            className="flex-1 h-8 rounded-md bg-red text-white text-[11.5px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Supprimer définitivement
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTyped("");
            }}
            className="h-8 px-3 rounded-md border border-line text-[11.5px] font-semibold text-ink-soft"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
