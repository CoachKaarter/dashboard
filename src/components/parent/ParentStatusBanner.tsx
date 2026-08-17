import { CheckIcon, LockIcon, AlertIcon } from "./icons";

type Tone = "success" | "info" | "warning" | "locked" | "neutral";

const TONE_STYLES: Record<Tone, { bg: string; border: string; fg: string; fgSoft: string }> = {
  success: { bg: "#ECF5EF", border: "#CFE6D6", fg: "#3F8F5B", fgSoft: "#5C8465" },
  info: { bg: "#EDF2F8", border: "#D3E0EC", fg: "#3C6E9F", fgSoft: "#5C82A8" },
  warning: { bg: "#FDF3E4", border: "#F0DFC0", fg: "#C97A17", fgSoft: "#8A6A3A" },
  locked: { bg: "#F1F1EE", border: "#E3E3DE", fg: "#6E7178", fgSoft: "#8A8D93" },
  neutral: { bg: "#F6F6F4", border: "#E7E7E2", fg: "#16181C", fgSoft: "#6E7178" },
};

const TONE_ICON = { success: CheckIcon, info: AlertIcon, warning: AlertIcon, locked: LockIcon, neutral: AlertIcon };

export function ParentStatusBanner({
  tone,
  title,
  detail,
  progress,
}: {
  tone: Tone;
  title: string;
  detail?: string;
  progress?: { done: number; total: number };
}) {
  const s = TONE_STYLES[tone];
  const Icon = TONE_ICON[tone];
  const pct = progress && progress.total > 0 ? Math.round((100 * progress.done) / progress.total) : 0;

  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
      <div className="flex items-center gap-2">
        <span className="shrink-0" style={{ color: s.fg }}>
          <Icon size={18} />
        </span>
        <span className="text-[14px] font-bold" style={{ color: s.fg }}>
          {title}
        </span>
      </div>
      {detail && (
        <div className="text-[12.5px] mt-1 ml-[26px]" style={{ color: s.fgSoft }}>
          {detail}
        </div>
      )}
      {progress && (
        <div className="mt-3 ml-[26px]">
          <div className="text-[12px] font-semibold mb-1.5" style={{ color: s.fgSoft }}>
            {progress.done} / {progress.total} réponses
          </div>
          <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.fg }} />
          </div>
        </div>
      )}
    </div>
  );
}
