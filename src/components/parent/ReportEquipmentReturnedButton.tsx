"use client";

import { useTransition } from "react";
import { reportEquipmentReturned } from "@/app/parent/(app)/actions";

/**
 * Cockpit v1.1 §7 — "demander une confirmation" avant d'envoyer le
 * signalement (spec) : un simple submit de formulaire ne peut pas montrer
 * de confirm() natif, d'où ce petit composant client dédié. Ne rend jamais
 * le prêt "récupéré" — seul le staff le fait (voir le commentaire sur
 * reportEquipmentReturned côté serveur).
 */
export function ReportEquipmentReturnedButton({ assignmentId, className, label }: { assignmentId: string; className: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (!window.confirm("Confirmez-vous avoir rapporté le sac de maillots ? Le staff devra encore valider la récupération.")) return;
        startTransition(() => {
          reportEquipmentReturned(assignmentId);
        });
      }}
    >
      {pending ? "Envoi..." : label}
    </button>
  );
}
