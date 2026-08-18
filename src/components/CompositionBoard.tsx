"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FORMATIONS, FORMATIONS_BY_FORMAT } from "@/lib/constants";
import { formationLabel } from "@/lib/format";
import { assignSlot, clearSlot, setFormation, toggleConvocation } from "@/app/(app)/matchs/actions";

type SquadPlayer = { id: string; name: string; initials: string; poste: string };

export function CompositionBoard({
  matchId,
  format,
  formation,
  slots,
  bench,
  nonConvoqued = [],
}: {
  matchId: string;
  format: string;
  formation: string;
  slots: Record<number, SquadPlayer>;
  bench: SquadPlayer[];
  nonConvoqued?: SquadPlayer[];
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addingExceptional, setAddingExceptional] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refresh() {
    startTransition(() => router.refresh());
  }

  const available = FORMATIONS_BY_FORMAT[format] ?? FORMATIONS_BY_FORMAT["Foot à 8"];
  const activeFormation = available.includes(formation) ? formation : available[0];
  const positions = FORMATIONS[activeFormation] ?? FORMATIONS["1-3-3-1"];
  const titulaires = Object.keys(slots).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
      <section className="bg-surface border border-line rounded-lg p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Composition — {format.toLowerCase()}</span>
          <span className="flex-1" />
          {available.map((f) => (
            <button
              key={f}
              onClick={() => {
                if (activeFormation === f) return;
                if (titulaires > 0 && !window.confirm(`Changer de formation réinitialisera la composition actuelle (${titulaires} joueur${titulaires > 1 ? "s" : ""} placé${titulaires > 1 ? "s" : ""}). Continuer ?`)) {
                  return;
                }
                setFormation(matchId, f).then(refresh);
              }}
              className={`h-[26px] px-2.5 rounded-md font-mono text-[11px] font-bold border cursor-pointer ${
                activeFormation === f ? "bg-ink text-white border-ink" : "bg-surface text-ink-soft border-line"
              }`}
            >
              {formationLabel(f)}
            </button>
          ))}
        </div>

        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            height: 520,
            background: "repeating-linear-gradient(0deg, #4A7A52 0 52px, #457349 52px 104px)",
            border: "2px solid #FFFFFF",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35)",
          }}
        >
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/35" />
          <div className="absolute left-1/2 top-1/2 w-24 h-24 border border-white/35 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute left-1/2 bottom-0 w-[200px] h-[74px] border border-white/35 border-b-0 -translate-x-1/2" />
          <div className="absolute left-1/2 top-0 w-[200px] h-[74px] border border-white/35 border-t-0 -translate-x-1/2" />

          {positions.map(([x, y, role], i) => {
            const player = slots[i];
            return (
              <div
                key={i}
                className="absolute w-[70px] text-center cursor-pointer -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragging) return;
                  assignSlot(matchId, i, dragging).then(refresh);
                  setDragging(null);
                }}
                onClick={() => {
                  // Alternative tactile au drag & drop (§139) : sélectionner un
                  // remplaçant puis toucher un poste (libre ou occupé) l'y place.
                  if (selected) {
                    assignSlot(matchId, i, selected).then(refresh);
                    setSelected(null);
                    return;
                  }
                  if (!player) return;
                  clearSlot(matchId, i).then(refresh);
                }}
              >
                <div
                  className="w-[42px] h-[42px] mx-auto rounded-full flex items-center justify-center text-[13px] font-bold border-2"
                  style={{
                    color: player ? "#14161A" : "#7E8B7F",
                    background: player ? "#FFFFFF" : "rgba(255,255,255,0.14)",
                    borderColor: selected ? "#FFD166" : "#FFFFFF",
                    borderStyle: player ? "solid" : "dashed",
                    boxShadow: selected ? "0 0 0 3px rgba(255,209,102,0.35)" : undefined,
                  }}
                >
                  {player ? player.initials : ""}
                </div>
                <div className="mt-1 text-[10.5px] font-semibold text-white/90" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                  {player ? player.name.split(" ")[0] : ""}
                </div>
                <div className="font-mono text-[9.5px] text-white/65">{role}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 text-xs text-muted">
          {selected
            ? "Joueur sélectionné — touchez un poste pour le placer."
            : "Glisser un joueur convoqué sur un poste (ou le sélectionner ci-contre puis toucher un poste). Toucher un poste occupé le libère."}
        </div>
      </section>

      <section className="bg-surface border border-line rounded-lg p-3.5">
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Remplaçants</span>
          <span className="flex-1" />
          <span className="font-mono text-[11px] text-muted">
            Titulaires {titulaires}/{positions.length} · Remplaçants {bench.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {bench.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragging(p.id)}
              onDragEnd={() => setDragging(null)}
              onClick={() => setSelected(selected === p.id ? null : p.id)}
              className={`flex items-center gap-2.5 px-2.5 py-[7px] border rounded-md cursor-pointer ${
                selected === p.id ? "border-orange bg-orange-bg" : "border-line bg-surface"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-line-soft border border-line flex items-center justify-center text-[9.5px] font-bold text-ink-soft shrink-0">
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate">{p.name}</div>
                <div className="text-[11px] text-muted">{p.poste}</div>
              </div>
              <div className="text-[#C9CBC7] text-[13px]">⠿</div>
            </div>
          ))}
          {bench.length === 0 && <div className="text-[12.5px] text-muted-2 py-2">Tous les convoqués sont placés.</div>}
        </div>

        {nonConvoqued.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line-soft">
            {addingExceptional ? (
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                {nonConvoqued.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      toggleConvocation(matchId, p.id).then(refresh);
                      setAddingExceptional(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-[7px] border border-dashed border-line rounded-md text-left hover:border-ink"
                  >
                    <span className="text-[12.5px] font-semibold flex-1 truncate">{p.name}</span>
                    <span className="text-[11px] text-muted">{p.poste}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingExceptional(true)}
                className="w-full h-8 border border-dashed border-line rounded-md text-[11.5px] font-semibold text-muted hover:border-ink hover:text-ink"
              >
                + Ajouter exceptionnellement un joueur
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
