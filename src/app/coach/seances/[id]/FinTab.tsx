import Link from "next/link";
import { terminerSeance } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CheckIcon } from "@/components/coach/icons";
import type { TrainingSession, SessionBlock } from "@/generated/prisma/client";
import type { BoardPlayer } from "@/components/coach/AttendanceBoard";

const RATINGS = ["Très difficile", "Difficile", "Correcte", "Bonne", "Très bonne"];

function sessionDurationMinutes(session: TrainingSession) {
  const [sh, sm] = session.startTime.split(":").map(Number);
  const [eh, em] = session.endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function FinTab({
  sessionId,
  session,
  players,
  blocks,
}: {
  sessionId: string;
  session: TrainingSession;
  players: BoardPlayer[];
  blocks: SessionBlock[];
}) {
  const present = players.filter((p) => p.code === "P").length;
  const retard = players.filter((p) => p.code === "R").length;
  const aj = players.filter((p) => p.code === "AJ").length;
  const anj = players.filter((p) => p.code === "ANJ").length;
  const blesse = players.filter((p) => p.code === "B").length;

  const done = blocks.filter((b) => b.status === "DONE").length;
  const skipped = blocks.filter((b) => b.status === "SKIPPED").length;
  const plannedMinutes = sessionDurationMinutes(session);
  const realizedBlocks = blocks.filter((b) => b.actualDurationMinutes !== null);
  const realizedMinutes = realizedBlocks.length ? realizedBlocks.reduce((n, b) => n + (b.actualDurationMinutes ?? 0), 0) : null;

  if (session.status === "Réalisée") {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-6 text-center animate-fadein">
        <div className="text-green flex justify-center mb-2 animate-checkpop">
          <CheckIcon size={28} />
        </div>
        <div className="text-[18px] font-bold">Séance terminée</div>
        <div className="text-[14px] text-[#6E7178] mt-2">
          {present} présent{present > 1 ? "s" : ""}
          {realizedMinutes !== null ? ` · ${realizedMinutes} min réalisées` : ""}
        </div>
        <Link
          href="/coach"
          className="inline-block mt-5 h-11 px-5 rounded-xl bg-ink text-white text-[14px] font-bold leading-[44px] active:scale-[0.98] transition-transform duration-100"
        >
          Retour à Aujourd&apos;hui
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3] mb-2">Pointage</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
          <span>
            <b>{present}</b> présent{present > 1 ? "s" : ""}
          </span>
          {retard > 0 && (
            <span>
              <b>{retard}</b> retard{retard > 1 ? "s" : ""}
            </span>
          )}
          {aj > 0 && (
            <span>
              <b>{aj}</b> AJ
            </span>
          )}
          {anj > 0 && (
            <span className="text-red">
              <b>{anj}</b> ANJ
            </span>
          )}
          {blesse > 0 && (
            <span className="text-red">
              <b>{blesse}</b> blessé{blesse > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {blocks.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3] mb-2">Contenu</div>
          <div className="text-[13.5px]">
            {blocks.length} bloc{blocks.length > 1 ? "s" : ""} prévu{blocks.length > 1 ? "s" : ""} · {done} réalisé{done > 1 ? "s" : ""}
            {skipped > 0 ? ` · ${skipped} passé${skipped > 1 ? "s" : ""}` : ""}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3] mb-2">Durée</div>
        <div className="flex gap-5 text-[13.5px]">
          <span>
            Prévue : <b>{plannedMinutes} min</b>
          </span>
          {realizedMinutes !== null && (
            <span>
              Réalisée : <b>{realizedMinutes} min</b>
            </span>
          )}
        </div>
      </div>

      <form action={terminerSeance.bind(null, sessionId)}>
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex flex-col gap-3">
          <div className="text-[14px] font-bold">Comment s&apos;est passée la séance ?</div>
          <div className="grid grid-cols-2 gap-1.5">
            {RATINGS.map((r) => (
              <label key={r}>
                <input type="radio" name="rating" value={r} className="peer sr-only" />
                <div className="h-11 rounded-xl border-2 border-[#E7E7E2] bg-white text-[12.5px] font-semibold flex items-center justify-center text-center px-1 peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-[1.02] transition-all duration-150">
                  {r}
                </div>
              </label>
            ))}
          </div>
          <input
            name="comment"
            placeholder="Note rapide (facultatif)"
            className="h-11 border border-[#E7E7E2] rounded-xl px-3 text-[13.5px] bg-[#FCFCFB] outline-none focus:border-blue"
          />
          <SubmitButton pendingLabel="…" className="h-12 rounded-xl bg-ink text-white text-[15px] font-bold mt-1">
            Terminer la séance
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
