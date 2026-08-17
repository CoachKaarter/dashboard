"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon } from "./icons";
import { ParentToast } from "./ParentToast";

type Status = "AVAILABLE" | "UNAVAILABLE";

export function AvailabilityChoice({
  status,
  onSetStatus,
  presentLabel = "Présent",
  absentLabel = "Absent",
  reasons,
  currentReason,
  onSetReason,
  locked = false,
}: {
  status: Status | null | undefined;
  onSetStatus: (status: Status) => Promise<void>;
  presentLabel?: string;
  absentLabel?: string;
  reasons?: string[];
  currentReason?: string | null;
  onSetReason?: (formData: FormData) => Promise<void>;
  locked?: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useState<Status | null>(status ?? null);
  const [editing, setEditing] = useState(!status);
  const [, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);

  function choose(next: Status) {
    setOptimisticStatus(next);
    setEditing(false);
    startTransition(() => {
      onSetStatus(next).then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 1400);
      });
    });
  }

  if (locked) {
    return optimisticStatus ? (
      <div className={`text-[13.5px] font-bold ${optimisticStatus === "AVAILABLE" ? "text-green" : "text-red"}`}>
        {optimisticStatus === "AVAILABLE" ? `✓ ${presentLabel}` : `✕ ${absentLabel}`}
      </div>
    ) : (
      <div className="text-[13px] text-[#8A8D93] italic">Pas de réponse enregistrée.</div>
    );
  }

  if (!editing && optimisticStatus) {
    return (
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[13.5px] font-bold ${
              optimisticStatus === "AVAILABLE" ? "bg-green-bg text-green" : "bg-red-bg text-red"
            }`}
          >
            {optimisticStatus === "AVAILABLE" ? <CheckIcon size={15} /> : <XIcon size={15} />}
            {optimisticStatus === "AVAILABLE" ? presentLabel : absentLabel}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-semibold text-[#8A8D93] underline underline-offset-2">
            Modifier
          </button>
          <ParentToast show={showToast} />
        </div>
        {optimisticStatus === "UNAVAILABLE" && reasons && onSetReason && (
          <div className="mt-3 pt-3 border-t border-[#EFEFEC]">
            <div className="text-[11.5px] font-semibold text-[#8A8D93] mb-1.5">Motif (facultatif)</div>
            <div className="flex gap-1.5 flex-wrap">
              {reasons.map((r) => (
                <form key={r} action={onSetReason}>
                  <input type="hidden" name="absenceReason" value={r} />
                  <button
                    type="submit"
                    className={`h-8 px-3 rounded-full text-[12.5px] font-semibold border ${
                      currentReason === r ? "bg-ink text-white border-ink" : "bg-white border-[#E7E7E2] text-[#6E7178]"
                    }`}
                  >
                    {r}
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => choose("AVAILABLE")}
        className={`flex-1 h-12 rounded-xl text-[14px] font-bold border-2 active:scale-[0.98] transition-transform ${
          optimisticStatus === "AVAILABLE" ? "bg-green border-green text-white" : "bg-white border-[#E7E7E2] text-green"
        }`}
      >
        ✓ {presentLabel}
      </button>
      <button
        type="button"
        onClick={() => choose("UNAVAILABLE")}
        className={`flex-1 h-12 rounded-xl text-[14px] font-bold border-2 active:scale-[0.98] transition-transform ${
          optimisticStatus === "UNAVAILABLE" ? "bg-red border-red text-white" : "bg-white border-[#E7E7E2] text-red"
        }`}
      >
        ✕ {absentLabel}
      </button>
    </div>
  );
}
