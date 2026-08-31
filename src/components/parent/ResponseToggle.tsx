"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon } from "./icons";
import { ParentToast } from "./ParentToast";

export type ToggleValue = "YES" | "NO";

// Primitive partagée par AvailabilityChoice (séance/week-end) et
// ConvocationChoice (match) — règle UX Onzevo générique (brief V6 §12) :
// action à faire -> contrôles ; action terminée -> son résultat + "Modifier
// ma réponse" ; modifier -> rouvre les contrôles.
export function ResponseToggle({
  value,
  onSetValue,
  yesLabel,
  noLabel,
  yesConfirmedTitle,
  yesConfirmedDescription,
  noConfirmedTitle,
  noConfirmedDescription,
  locked = false,
  extra,
}: {
  value: ToggleValue | null | undefined;
  onSetValue: (value: ToggleValue) => Promise<void>;
  yesLabel: string;
  noLabel: string;
  yesConfirmedTitle: string;
  yesConfirmedDescription: string;
  noConfirmedTitle: string;
  noConfirmedDescription: string;
  locked?: boolean;
  extra?: (value: ToggleValue) => React.ReactNode;
}) {
  const [optimisticValue, setOptimisticValue] = useState<ToggleValue | null>(value ?? null);
  const [editing, setEditing] = useState(!value);
  const [, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);

  function choose(next: ToggleValue) {
    setOptimisticValue(next);
    setEditing(false);
    startTransition(() => {
      onSetValue(next).then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
    });
  }

  if (locked) {
    return optimisticValue ? (
      <div className={`text-[13.5px] font-bold ${optimisticValue === "YES" ? "text-green" : "text-red"}`}>
        {optimisticValue === "YES" ? `✓ ${yesLabel}` : `✕ ${noLabel}`}
      </div>
    ) : (
      <div className="text-[13px] text-[#8A8D93] italic">Pas de réponse enregistrée.</div>
    );
  }

  if (!editing && optimisticValue) {
    const isYes = optimisticValue === "YES";
    return (
      <div className="animate-fadein">
        <div className={`rounded-xl px-3.5 py-3 ${isYes ? "bg-green-bg" : "bg-red-bg"}`}>
          <div className={`flex items-center gap-1.5 text-[13.5px] font-bold ${isYes ? "text-green" : "text-red"}`}>
            {isYes ? <CheckIcon size={15} /> : <XIcon size={15} />}
            {isYes ? yesConfirmedTitle : noConfirmedTitle}
          </div>
          <div className="text-[12.5px] text-[#6E7178] mt-1">{isYes ? yesConfirmedDescription : noConfirmedDescription}</div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12.5px] font-semibold text-[#8A8D93] underline underline-offset-2 mt-2 active:opacity-60 transition-opacity duration-100"
          >
            Modifier ma réponse
          </button>
        </div>
        <ParentToast show={showToast} />
        {extra?.(optimisticValue)}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => choose("YES")}
        className={`flex-1 h-12 rounded-xl text-[14px] font-bold border-2 active:scale-[0.98] transition-all duration-150 ${
          optimisticValue === "YES" ? "bg-green border-green text-white" : "bg-white border-[#E7E7E2] text-green"
        }`}
      >
        ✓ {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => choose("NO")}
        className={`flex-1 h-12 rounded-xl text-[14px] font-bold border-2 active:scale-[0.98] transition-all duration-150 ${
          optimisticValue === "NO" ? "bg-red border-red text-white" : "bg-white border-[#E7E7E2] text-red"
        }`}
      >
        ✕ {noLabel}
      </button>
    </div>
  );
}
