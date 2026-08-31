import Link from "next/link";
import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { CheckIcon } from "@/components/coach/icons";
import type { TrainingSession, SessionBlock } from "@/generated/prisma/client";

const STATUS_DOT: Record<string, string> = { DONE: "#3F8F5B", IN_PROGRESS: "#C97A17", SKIPPED: "#9A9DA3", PENDING: "#D2D2CB" };

export function SeanceTab({
  session,
  blocks,
  playerCount,
}: {
  session: TrainingSession;
  blocks: SessionBlock[];
  playerCount: number;
}) {
  const totalMinutes = blocks.reduce((n, b) => n + b.durationMinutes, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-[19px] font-bold">{playerCount}</div>
            <div className="text-[10.5px] text-[#9A9DA3] uppercase tracking-[0.05em]">Joueurs</div>
          </div>
          {totalMinutes > 0 && (
            <div>
              <div className="font-mono text-[19px] font-bold">{totalMinutes}&apos;</div>
              <div className="text-[10.5px] text-[#9A9DA3] uppercase tracking-[0.05em]">Prévues</div>
            </div>
          )}
        </div>
        {session.theme && (
          <div className="mt-3 pt-3 border-t border-[#EFEFEC]">
            <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">Thème</div>
            <div className="text-[14.5px] font-semibold mt-0.5">{session.theme}</div>
          </div>
        )}
        {session.objective && (
          <div className="mt-2.5">
            <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">Objectif du jour</div>
            <div className="text-[14.5px] font-semibold mt-0.5">{session.objective}</div>
          </div>
        )}
      </div>

      {blocks.length > 0 && (
        <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">Programme</div>
      )}
      {blocks.map((b, i) => (
        <Link
          key={b.id}
          href={`/coach/seances/${b.sessionId}/procede/${b.id}`}
          className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex items-center gap-3 active:bg-[#FAFAF8] transition-colors duration-100"
        >
          <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: STATUS_DOT[b.status] }}>
            {b.status === "DONE" ? (
              <CheckIcon size={13} />
            ) : (
              <span className="font-mono text-[11px] font-bold" style={{ color: STATUS_DOT[b.status] }}>
                {i + 1}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#9A9DA3] uppercase tracking-[0.04em]">
              {SESSION_BLOCK_TYPE_LABELS[b.type] ?? b.type}
            </div>
            <div className="text-[14.5px] font-bold truncate">{b.title}</div>
          </div>
          <div className="font-mono text-[13px] font-bold text-[#9A9DA3] shrink-0">{b.durationMinutes}&apos;</div>
        </Link>
      ))}

      {blocks.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-6 text-center text-[13.5px] text-[#8A8D93]">
          Aucun contenu préparé pour cette séance.
        </div>
      )}
    </div>
  );
}
