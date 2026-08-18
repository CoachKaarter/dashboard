"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AttendanceStatusButton } from "./AttendanceStatusButton";
import { CoachToast } from "./CoachToast";

const CODES = ["P", "R", "AJ", "ANJ", "B"] as const;
const NOTE_CODES = new Set(["R", "AJ", "ANJ", "B"]);

export function AttendancePlayerRow({
  firstName,
  lastName,
  code,
  note,
  saving,
  justSaved,
  delayMinutes,
  familyStatus,
  familyReason,
  onSetCode,
  onSetNote,
}: {
  firstName: string;
  lastName: string;
  code: string | null;
  note: string | null;
  saving: boolean;
  justSaved: boolean;
  delayMinutes: number | null;
  familyStatus: "AVAILABLE" | "UNAVAILABLE" | null;
  familyReason: string | null;
  onSetCode: (code: string) => void;
  onSetNote: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note ?? "");

  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5">
      <div className="flex items-center gap-2.5">
        <Avatar initials={`${firstName[0]}${lastName[0]}`} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-bold truncate">
            {firstName} {lastName.charAt(0)}.
          </div>
          {familyStatus && (
            <div className={`text-[11.5px] mt-0.5 ${familyStatus === "UNAVAILABLE" ? "text-orange" : "text-[#9A9DA3]"}`}>
              Famille : {familyStatus === "AVAILABLE" ? "Disponible" : `Absent${familyReason ? ` · ${familyReason}` : ""}`}
            </div>
          )}
          {code === "R" && delayMinutes !== null && (
            <div className="text-[11.5px] text-orange mt-0.5 font-semibold">Retard · +{delayMinutes} min</div>
          )}
        </div>
        <CoachToast show={justSaved} />
      </div>

      <div className="flex items-center gap-1.5 mt-3 justify-between">
        {CODES.map((c) => (
          <AttendanceStatusButton key={c} code={c} active={code === c} onClick={() => onSetCode(c)} />
        ))}
      </div>

      {code && NOTE_CODES.has(code) && (
        <div className="mt-2.5">
          {!noteOpen && !note && (
            <button type="button" onClick={() => setNoteOpen(true)} className="text-[12px] font-semibold text-blue">
              + Ajouter une note
            </button>
          )}
          {note && !noteOpen && (
            <button type="button" onClick={() => setNoteOpen(true)} className="text-[12px] text-[#6E7178] italic text-left">
              {note}
            </button>
          )}
          {noteOpen && (
            <div className="flex gap-1.5">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Motif, précision…"
                className="h-9 flex-1 min-w-0 border border-[#E7E7E2] rounded-lg px-2.5 text-[12.5px] bg-[#FCFCFB] outline-none focus:border-blue"
              />
              <button
                type="button"
                onClick={() => {
                  onSetNote(noteDraft);
                  setNoteOpen(false);
                }}
                className="h-9 px-3 rounded-lg bg-ink text-white text-[12px] font-semibold active:scale-95 transition-transform duration-100"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
      {saving && <div className="text-[10.5px] text-[#9A9DA3] mt-1.5">Enregistrement…</div>}
    </div>
  );
}
