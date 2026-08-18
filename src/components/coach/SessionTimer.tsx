"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon, PauseIcon, SkipIcon, CheckIcon } from "./icons";
import { useWakeLock } from "@/lib/useWakeLock";

function fmt(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "+" : "";
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionTimer({
  plannedMinutes,
  status,
  startedAt,
  onStart,
  onComplete,
  onSkip,
}: {
  plannedMinutes: number;
  status: string;
  startedAt: Date | null;
  onStart: () => Promise<void>;
  onComplete: (actualMinutes: number) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const router = useRouter();
  // A reload mid-timer has no persisted pause history — treat it as having
  // run continuously since startedAt. Acceptable per §54 (no full offline
  // support required); still correct for the common uninterrupted case.
  // Date.now() is impure, so it's read inside the lazy initializer (runs
  // once) rather than the render body itself.
  const [elapsed, setElapsed] = useState(() =>
    status === "IN_PROGRESS" && startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0
  );
  const [running, setRunning] = useState(status === "IN_PROGRESS");
  const [extendedSeconds, setExtendedSeconds] = useState(0);
  const [pending, setPending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibratedRef = useRef(false);

  useWakeLock(running);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const plannedSeconds = plannedMinutes * 60 + extendedSeconds;
  const remaining = plannedSeconds - elapsed;

  useEffect(() => {
    if (remaining <= 0 && running && !vibratedRef.current) {
      vibratedRef.current = true;
      navigator.vibrate?.(200);
    } else if (remaining > 0) {
      vibratedRef.current = false;
    }
  }, [remaining, running]);

  async function handleStart() {
    setRunning(true);
    setPending(true);
    try {
      await onStart();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleComplete() {
    setRunning(false);
    setPending(true);
    try {
      await onComplete(Math.round(elapsed / 60));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleSkip() {
    setRunning(false);
    setPending(true);
    try {
      await onSkip();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (status === "DONE") {
    return (
      <div className="bg-green-bg rounded-2xl p-5 text-center animate-checkpop">
        <div className="text-green flex justify-center mb-1">
          <CheckIcon size={22} />
        </div>
        <div className="text-[14px] font-bold text-green">Bloc terminé</div>
      </div>
    );
  }
  if (status === "SKIPPED") {
    return (
      <div className="bg-[#F1F1EE] rounded-2xl p-5 text-center">
        <div className="text-[14px] font-bold text-[#6E7178]">Bloc passé</div>
      </div>
    );
  }

  const notStarted = !running && elapsed === 0 && status === "PENDING";

  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5">
      <div className="text-center">
        <div className={`font-mono text-[42px] font-bold tracking-[-0.02em] transition-colors duration-200 ${remaining <= 0 ? "text-orange" : "text-ink"}`}>
          {fmt(remaining)}
        </div>
        {remaining <= 0 && <div className="text-[13px] text-orange font-semibold mt-1 animate-fadein">Temps prévu terminé</div>}
      </div>

      <div className="flex gap-2 mt-4">
        {notStarted ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={pending}
            className="flex-1 h-14 rounded-xl bg-ink text-white text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-100"
          >
            <PlayIcon size={18} /> Démarrer
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="flex-1 h-14 rounded-xl border-2 border-ink text-ink text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform duration-100"
            >
              {running ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
              {running ? "Pause" : "Reprendre"}
            </button>
            <button
              type="button"
              onClick={() => setExtendedSeconds((s) => s + 60)}
              className="h-14 px-4 rounded-xl border-2 border-[#E7E7E2] text-[13px] font-bold text-[#6E7178] active:scale-[0.98] transition-transform duration-100"
            >
              +1 min
            </button>
          </>
        )}
      </div>

      {(running || elapsed > 0) && (
        <button
          type="button"
          onClick={handleComplete}
          disabled={pending}
          className="w-full h-12 rounded-xl bg-green text-white text-[14.5px] font-bold mt-2.5 active:scale-[0.98] transition-transform duration-100"
        >
          Terminer
        </button>
      )}
      <button
        type="button"
        onClick={handleSkip}
        disabled={pending}
        className="w-full h-11 rounded-xl text-[13px] font-semibold text-[#9A9DA3] mt-1.5 flex items-center justify-center gap-1.5 active:opacity-60"
      >
        <SkipIcon size={14} /> Passer ce bloc
      </button>
    </div>
  );
}
