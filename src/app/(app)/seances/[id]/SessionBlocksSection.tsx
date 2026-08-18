import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { createBlock, updateBlock, deleteBlock, moveBlockUp, moveBlockDown } from "./blocks-actions";
import type { SessionBlock } from "@/generated/prisma/client";

const inputClass =
  "h-8 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";
const textareaClass =
  "border border-line rounded-md px-2.5 py-2 text-[12.5px] bg-surface outline-none w-full resize-y focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

function BlockFields({ block }: { block?: SessionBlock }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-muted">Type</span>
          <select name="type" defaultValue={block?.type ?? "EXERCICE"} className={inputClass}>
            {Object.entries(SESSION_BLOCK_TYPE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-muted">Durée (min)</span>
          <input type="number" name="durationMinutes" min={1} defaultValue={block?.durationMinutes ?? 15} required className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] text-muted">Nom du procédé</span>
        <input name="title" defaultValue={block?.title ?? ""} required placeholder="ex. Jeu de face / troisième homme" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] text-muted">Objectif</span>
        <input name="objective" defaultValue={block?.objective ?? ""} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-muted">Organisation</span>
          <input name="organization" defaultValue={block?.organization ?? ""} placeholder="ex. 3 groupes de 6" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-muted">Espace</span>
          <input name="space" defaultValue={block?.space ?? ""} placeholder="ex. 20 × 15 m" className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] text-muted">Matériel</span>
        <input name="equipment" defaultValue={block?.equipment ?? ""} placeholder="ex. 12 coupelles, 6 ballons" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] text-muted">Consignes</span>
        <textarea name="instructions" rows={3} defaultValue={block?.instructions ?? ""} className={textareaClass} />
      </label>
      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] text-muted">Schéma (URL image)</span>
        <input name="imageUrl" defaultValue={block?.imageUrl ?? ""} placeholder="https://…" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 mt-2.5">
        <span className="text-[10.5px] text-muted">Note privée coach (jamais visible côté parent)</span>
        <textarea name="coachNote" rows={2} defaultValue={block?.coachNote ?? ""} className={textareaClass} />
      </label>
    </>
  );
}

export function SessionBlocksSection({ sessionId, blocks }: { sessionId: string; blocks: SessionBlock[] }) {
  return (
    <details className="bg-surface border border-line rounded-lg mt-3.5">
      <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold text-muted hover:text-ink select-none flex items-center gap-2">
        Contenu de séance
        {blocks.length > 0 && <span className="font-mono text-[11px] text-muted-2">{blocks.length}</span>}
      </summary>
      <div className="px-3.5 pb-3.5 flex flex-col gap-2.5">
        {blocks.map((b, i) => (
          <details key={b.id} className="border border-line-soft rounded-md">
            <summary className="cursor-pointer px-3 py-2 flex items-center gap-2.5 select-none">
              <span className="font-mono text-[11px] text-muted-2 w-4">{i + 1}</span>
              <span className="text-[10.5px] font-bold tracking-[0.05em] uppercase text-muted">
                {SESSION_BLOCK_TYPE_LABELS[b.type] ?? b.type}
              </span>
              <span className="text-[12.5px] font-semibold flex-1 truncate">{b.title}</span>
              <span className="font-mono text-[11.5px] text-muted">{b.durationMinutes}&apos;</span>
            </summary>
            <div className="px-3 pb-3 pt-1 border-t border-line-soft-2">
              <div className="flex gap-1.5 mb-2.5">
                <form action={moveBlockUp.bind(null, sessionId, b.id)}>
                  <button type="submit" disabled={i === 0} className="h-7 px-2 border border-line rounded-md text-[11px] font-semibold text-muted hover:border-ink disabled:opacity-30">
                    ↑
                  </button>
                </form>
                <form action={moveBlockDown.bind(null, sessionId, b.id)}>
                  <button type="submit" disabled={i === blocks.length - 1} className="h-7 px-2 border border-line rounded-md text-[11px] font-semibold text-muted hover:border-ink disabled:opacity-30">
                    ↓
                  </button>
                </form>
                <span className="flex-1" />
                <form action={deleteBlock.bind(null, sessionId, b.id)}>
                  <button type="submit" className="h-7 px-2 border border-line rounded-md text-[11px] font-semibold text-red hover:border-red">
                    Supprimer
                  </button>
                </form>
              </div>
              <form action={updateBlock.bind(null, sessionId, b.id)}>
                <BlockFields block={b} />
                <button type="submit" className="mt-2.5 h-8 px-3 border-none rounded-md bg-ink text-white text-[11.5px] font-semibold hover:bg-[#2A2E36]">
                  Enregistrer
                </button>
              </form>
            </div>
          </details>
        ))}

        <details>
          <summary className="cursor-pointer px-3 py-2 border border-dashed border-line rounded-md text-[12px] font-semibold text-muted hover:border-ink hover:text-ink select-none">
            + Ajouter un bloc
          </summary>
          <div className="px-3 pt-2.5">
            <form action={createBlock.bind(null, sessionId)}>
              <BlockFields />
              <button type="submit" className="mt-2.5 h-8 px-3 border-none rounded-md bg-ink text-white text-[11.5px] font-semibold hover:bg-[#2A2E36]">
                Ajouter
              </button>
            </form>
          </div>
        </details>
      </div>
    </details>
  );
}
