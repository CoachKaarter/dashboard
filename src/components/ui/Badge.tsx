import { ReactNode } from "react";

export type Tone = "green" | "orange" | "red" | "blue" | "purple" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  green: "text-green bg-green-bg",
  orange: "text-orange bg-orange-bg",
  red: "text-red bg-red-bg",
  blue: "text-blue bg-blue-bg",
  purple: "text-purple bg-purple-bg",
  neutral: "text-neutral-badge bg-neutral-badge-bg",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center h-[19px] px-[7px] rounded text-[11px] font-semibold whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function MonoBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center h-[19px] px-[7px] rounded font-mono text-[10.5px] font-bold tracking-[0.04em] border ${
        tone === "blue"
          ? "text-blue bg-blue-bg border-blue/[0.18]"
          : tone === "purple"
            ? "text-purple bg-purple-bg border-purple/[0.18]"
            : "text-neutral-badge bg-neutral-badge-bg border-line"
      }`}
    >
      {children}
    </span>
  );
}
