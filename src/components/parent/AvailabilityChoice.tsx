"use client";

import { ResponseToggle, type ToggleValue } from "./ResponseToggle";

type Status = "AVAILABLE" | "UNAVAILABLE";

export function AvailabilityChoice({
  status,
  onSetStatus,
  presentLabel = "Présent",
  absentLabel = "Absent",
  confirmedTitle = "Présence confirmée",
  confirmedDescription = "Vous avez confirmé la présence de votre enfant.",
  declinedTitle = "Absence signalée",
  declinedDescription = "Vous avez indiqué que votre enfant ne sera pas présent.",
  reasons,
  currentReason,
  onSetReason,
  locked = false,
}: {
  status: Status | null | undefined;
  onSetStatus: (status: Status) => Promise<void>;
  presentLabel?: string;
  absentLabel?: string;
  confirmedTitle?: string;
  confirmedDescription?: string;
  declinedTitle?: string;
  declinedDescription?: string;
  reasons?: string[];
  currentReason?: string | null;
  onSetReason?: (formData: FormData) => Promise<void>;
  locked?: boolean;
}) {
  return (
    <ResponseToggle
      value={status === "AVAILABLE" ? "YES" : status === "UNAVAILABLE" ? "NO" : null}
      onSetValue={(v: ToggleValue) => onSetStatus(v === "YES" ? "AVAILABLE" : "UNAVAILABLE")}
      yesLabel={presentLabel}
      noLabel={absentLabel}
      yesConfirmedTitle={confirmedTitle}
      yesConfirmedDescription={confirmedDescription}
      noConfirmedTitle={declinedTitle}
      noConfirmedDescription={declinedDescription}
      locked={locked}
      extra={(v) =>
        v === "NO" && reasons && onSetReason ? (
          <div className="mt-3 pt-3 border-t border-[#EFEFEC] animate-fadein">
            <div className="text-[11.5px] font-semibold text-[#8A8D93] mb-1.5">Motif (facultatif)</div>
            <div className="flex gap-1.5 flex-wrap">
              {reasons.map((r) => (
                <form key={r} action={onSetReason}>
                  <input type="hidden" name="absenceReason" value={r} />
                  <button
                    type="submit"
                    className={`h-8 px-3 rounded-full text-[12.5px] font-semibold border transition-colors duration-150 active:scale-[0.96] ${
                      currentReason === r ? "bg-ink text-white border-ink" : "bg-white border-[#E7E7E2] text-[#6E7178]"
                    }`}
                  >
                    {r}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null
      }
    />
  );
}
