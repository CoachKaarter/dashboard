"use client";

import { useEffect, useRef } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };

/**
 * Keeps the screen awake while `active` is true (pointage in progress, timer
 * running) — a locked phone mid-training is the whole failure mode this
 * guards against. Silently does nothing where the API is unavailable or
 * denied (§47 of the coach mobile spec: fallback silencieux).
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock;
    if (!active || !nav.wakeLock) return;

    let cancelled = false;
    nav.wakeLock
      .request("screen")
      .then((lock) => {
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
