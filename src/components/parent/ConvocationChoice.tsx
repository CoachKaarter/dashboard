"use client";

import { ResponseToggle, type ToggleValue } from "./ResponseToggle";

// Réponse à une convocation Match (MatchConvocation.confirmed) — même
// primitive que AvailabilityChoice (séance/week-end), copy dédiée au match.
// Corrige la micro-friction remontée : les boutons "Je viens"/"Absent"
// restaient affichés après réponse (brief V6 §14/§15).
export function ConvocationChoice({
  confirmed,
  onSetConfirmed,
}: {
  confirmed: boolean | null | undefined;
  onSetConfirmed: (confirmed: boolean) => Promise<void>;
}) {
  return (
    <ResponseToggle
      value={confirmed === true ? "YES" : confirmed === false ? "NO" : null}
      onSetValue={(v: ToggleValue) => onSetConfirmed(v === "YES")}
      yesLabel="Je viens"
      noLabel="Absent"
      yesConfirmedTitle="Présence confirmée"
      yesConfirmedDescription="Votre présence pour ce match est enregistrée."
      noConfirmedTitle="Absence signalée"
      noConfirmedDescription="Votre absence pour ce match est enregistrée."
    />
  );
}
