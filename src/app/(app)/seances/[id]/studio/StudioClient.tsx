"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { addLibraryItemToSession, deleteBlock, reorderBlocks, createBlock } from "../blocks-actions";
import { searchLibraryItems } from "@/app/(app)/bibliotheque/actions";
import { createTemplateFromSession, applyTemplateToSession } from "@/app/(app)/bibliotheque/template-actions";
import type { SessionBlock } from "@/generated/prisma/client";

type LibItem = { id: string; title: string; type: string; defaultDurationMinutes: number | null; minPlayers: number | null };
type Effectif = { total: number; available: number; unavailable: number; noResponse: number };

export function StudioClient({
  sessionId,
  initialBlocks,
  plannedMinutes,
  effectif,
  initialFavorites,
  initialRecent,
  templates,
}: {
  sessionId: string;
  initialBlocks: SessionBlock[];
  plannedMinutes: number;
  effectif: Effectif;
  initialFavorites: LibItem[];
  initialRecent: LibItem[];
  templates: { id: string; name: string; blockCount: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LibItem[] | null>(null);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const blocks = initialBlocks;
  const totalMinutes = blocks.reduce((n, b) => n + b.durationMinutes, 0);
  const shownItems = query.trim() ? searchResults : [...initialFavorites, ...initialRecent];

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    startTransition(async () => {
      setSearchResults(await searchLibraryItems(q));
    });
  }

  function addItem(contentItemId: string) {
    startTransition(async () => {
      await addLibraryItemToSession(sessionId, contentItemId);
      flash("Ajouté à la séance");
      router.refresh();
    });
  }

  function removeBlock(blockId: string) {
    startTransition(async () => {
      await deleteBlock(sessionId, blockId);
      router.refresh();
    });
  }

  function onDropReorder(targetId: string) {
    if (!dragBlockId || dragBlockId === targetId) return;
    const ids = blocks.map((b) => b.id);
    const from = ids.indexOf(dragBlockId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ...ids.splice(from, 1));
    setDragBlockId(null);
    startTransition(async () => {
      await reorderBlocks(sessionId, ids);
      router.refresh();
    });
  }

  function onDropFromLibrary() {
    // dragBlockId doubles as the dragged library item id when prefixed
    if (dragBlockId?.startsWith("lib:")) {
      const contentItemId = dragBlockId.slice(4);
      setDragBlockId(null);
      addItem(contentItemId);
    }
  }

  function saveAsTemplate() {
    const name = window.prompt("Nom du modèle :", "");
    if (!name?.trim()) return;
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("visibility", "PERSONAL");
    startTransition(async () => {
      await createTemplateFromSession(sessionId, fd);
    });
  }

  function applyTemplate(mode: "append" | "replace") {
    if (!selectedTemplate) return;
    if (mode === "replace" && !window.confirm("Remplacer tout le contenu actuel de la séance par ce modèle ?")) return;
    startTransition(async () => {
      await applyTemplateToSession(sessionId, selectedTemplate, mode);
      flash("Modèle appliqué");
      router.refresh();
    });
  }

  function addFreeBlock(formData: FormData) {
    startTransition(async () => {
      await createBlock(sessionId, formData);
      router.refresh();
    });
  }

  const durationPct = Math.min(100, Math.round((totalMinutes / Math.max(1, plannedMinutes)) * 100));
  const ecart = totalMinutes - plannedMinutes;

  return (
    <div className="grid grid-cols-[280px_1fr_260px] gap-3.5 items-start">
      {/* Colonne bibliothèque */}
      <div className="bg-surface border border-line rounded-lg p-3 flex flex-col gap-2.5 sticky top-3.5">
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Rechercher un procédé…"
          className="h-8 border border-line rounded-md px-2.5 text-[12px] bg-bg outline-none focus:border-blue"
        />
        <div className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
          {query.trim() ? "Résultats" : "Favoris & récents"}
        </div>
        <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto">
          {shownItems?.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragBlockId(`lib:${item.id}`)}
              onDragEnd={() => setDragBlockId(null)}
              className="border border-line-soft rounded-md px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-ink transition-colors"
            >
              <div className="text-[9.5px] font-bold tracking-[0.06em] uppercase text-blue">{SESSION_BLOCK_TYPE_LABELS[item.type] ?? item.type}</div>
              <div className="text-[12px] font-semibold truncate">{item.title}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10.5px] text-muted-2 font-mono">{item.defaultDurationMinutes ? `${item.defaultDurationMinutes}'` : "—"}</span>
                <button
                  type="button"
                  onClick={() => addItem(item.id)}
                  disabled={pending}
                  className="h-6 px-2 border-none rounded bg-ink text-white text-[10.5px] font-semibold hover:bg-[#2A2E36]"
                >
                  +
                </button>
              </div>
              {item.minPlayers != null && effectif.available < item.minPlayers && (
                <div className="text-[10px] text-orange mt-1">⚠ Prévu pour au moins {item.minPlayers} joueurs</div>
              )}
            </div>
          ))}
          {shownItems?.length === 0 && <div className="text-[11.5px] text-muted px-1 py-2">Aucun résultat.</div>}
        </div>
        <Link href="/bibliotheque" className="text-[11px] text-muted hover:text-ink text-center pt-1 border-t border-line-soft">
          Ouvrir la bibliothèque complète →
        </Link>
      </div>

      {/* Colonne déroulé */}
      <div
        className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropFromLibrary}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Déroulé de la séance</div>
          {toast && <span className="text-[11px] font-semibold text-green">✓ {toast}</span>}
        </div>

        {blocks.map((b, i) => (
          <div
            key={b.id}
            draggable
            onDragStart={() => setDragBlockId(b.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation();
              onDropReorder(b.id);
            }}
            onDragEnd={() => setDragBlockId(null)}
            className={`border border-line rounded-md px-3 py-2.5 flex items-center gap-2.5 cursor-grab active:cursor-grabbing transition-shadow ${
              dragBlockId === b.id ? "opacity-50" : ""
            }`}
          >
            <span className="font-mono text-[11px] text-muted-2 w-4">{i + 1}</span>
            <span className="text-[9.5px] font-bold tracking-[0.06em] uppercase text-muted w-[70px] shrink-0">
              {SESSION_BLOCK_TYPE_LABELS[b.type] ?? b.type}
            </span>
            <span className="text-[12.5px] font-semibold flex-1 truncate">{b.title}</span>
            <span className="text-[10px] text-muted-2">{b.sourceLibraryItemId ? "Issu de la bibliothèque" : "Bloc libre"}</span>
            <span className="font-mono text-[11.5px] text-muted">{b.durationMinutes}&apos;</span>
            <button type="button" onClick={() => removeBlock(b.id)} className="h-6 px-2 border border-line rounded-md text-[10.5px] font-semibold text-red hover:border-red">
              Retirer
            </button>
          </div>
        ))}
        {blocks.length === 0 && (
          <div className="text-center text-muted text-[12.5px] py-8 border border-dashed border-line rounded-md">
            Glissez un procédé depuis la bibliothèque, ou ajoutez un bloc libre ci-dessous.
          </div>
        )}

        <details className="mt-1.5">
          <summary className="cursor-pointer px-3 py-2 border border-dashed border-line rounded-md text-[12px] font-semibold text-muted hover:border-ink hover:text-ink select-none">
            + Bloc libre
          </summary>
          <form action={addFreeBlock} className="flex items-end gap-2 pt-2.5">
            <select name="type" defaultValue="EXERCICE" className="h-8 border border-line rounded-md px-2 text-[12px] bg-surface">
              {Object.entries(SESSION_BLOCK_TYPE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
            <input name="title" required placeholder="Nom du bloc" className="h-8 flex-1 border border-line rounded-md px-2 text-[12px] bg-surface" />
            <input name="durationMinutes" type="number" min={1} defaultValue={15} required className="h-8 w-16 border border-line rounded-md px-2 text-[12px] bg-surface" />
            <button type="submit" className="h-8 px-3 border-none rounded-md bg-ink text-white text-[11.5px] font-semibold hover:bg-[#2A2E36]">
              Ajouter
            </button>
          </form>
        </details>

        <Link href={`/seances/${sessionId}`} className="text-[11px] text-muted hover:text-ink text-center pt-2 border-t border-line-soft mt-1.5">
          Modifier le détail d&apos;un bloc (organisation, matériel, consignes…) →
        </Link>
      </div>

      {/* Colonne résumé */}
      <div className="flex flex-col gap-3">
        <div className="bg-surface border border-line rounded-lg p-3.5">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Durée</div>
          <div className="w-full h-1.5 bg-line-soft rounded-full overflow-hidden mb-1.5">
            <div className={`h-full ${ecart > 0 ? "bg-orange" : "bg-green"}`} style={{ width: `${durationPct}%` }} />
          </div>
          <div className="font-mono text-[12.5px]">
            {totalMinutes} / {plannedMinutes} min planifiées
          </div>
          {ecart !== 0 && (
            <div className={`text-[11px] mt-0.5 ${ecart > 0 ? "text-orange" : "text-muted"}`}>
              {ecart > 0 ? `+${ecart} min` : `${Math.abs(ecart)} min non planifiées`}
            </div>
          )}
        </div>

        <div className="bg-surface border border-line rounded-lg p-3.5">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Effectif</div>
          <div className="font-mono text-[12.5px]">{effectif.total} joueurs concernés</div>
          <div className="text-[11.5px] text-green mt-0.5">{effectif.available} disponibles</div>
          {effectif.unavailable > 0 && <div className="text-[11.5px] text-red">{effectif.unavailable} absents annoncés</div>}
          {effectif.noResponse > 0 && <div className="text-[11.5px] text-muted">{effectif.noResponse} sans réponse</div>}
        </div>

        <div className="bg-surface border border-line rounded-lg p-3.5">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Modèles</div>
          <button
            type="button"
            onClick={saveAsTemplate}
            disabled={blocks.length === 0 || pending}
            className="w-full h-8 border border-line rounded-md text-[11.5px] font-semibold text-ink-soft hover:border-ink hover:text-ink disabled:opacity-40 mb-2"
          >
            Sauvegarder comme modèle
          </button>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full h-8 border border-line rounded-md px-2 text-[12px] bg-surface mb-2"
          >
            <option value="">Utiliser un modèle…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.blockCount})
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => applyTemplate("append")}
              disabled={!selectedTemplate || pending}
              className="flex-1 h-7 border border-line rounded-md text-[11px] font-semibold text-ink-soft hover:border-ink disabled:opacity-40"
            >
              Ajouter à la suite
            </button>
            <button
              type="button"
              onClick={() => applyTemplate("replace")}
              disabled={!selectedTemplate || pending}
              className="flex-1 h-7 border border-line rounded-md text-[11px] font-semibold text-red hover:border-red disabled:opacity-40"
            >
              Remplacer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
