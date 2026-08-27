"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { ConvocationPoster } from "@/components/ConvocationPoster";
import type { ConvocationPosterData } from "@/lib/convocation-poster";

const POSTER_WIDTH = 1600;

/**
 * Wraps the existing "Copier le message du dimanche" behavior (clipboard
 * copy) with the convocation poster preview + PNG export — one click does
 * both. The image generation failing must never break the copy: it always
 * runs first and its own try/catch is independent of the poster's.
 */
export function ConvocationCopyAndPoster({
  message,
  data,
  fileDateLabel,
  triggerClassName,
}: {
  message: string;
  data: ConvocationPosterData;
  fileDateLabel: string; // "JJ-MM-AAAA", pour le nom de fichier
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const posterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function updateScale() {
      const el = containerRef.current;
      if (!el) return;
      setScale(Math.min(1, (el.clientWidth - 32) / POSTER_WIDTH));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [open]);

  useEffect(() => {
    if (!open || !posterRef.current) return;
    const el = posterRef.current;
    const ro = new ResizeObserver(() => setNaturalSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  async function handleTrigger() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      // Presse-papiers indisponible (HTTP non sécurisé, permission refusée…)
      // — le visuel de convocation reste utile même sans la copie.
      setCopyFailed(true);
    }
    setExportError(null);
    setOpen(true);
  }

  async function handleDownload() {
    if (!posterRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      // Attendre le chargement des polices avant la capture — évite un
      // rendu avec la police système par défaut le temps que le fallback
      // s'applique (peu probable ici puisqu'on utilise Arial partout, mais
      // sans coût et protège aussi le chargement du logo club).
      await document.fonts.ready;
      const dataUrl = await toPng(posterRef.current, { width: POSTER_WIDTH, pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `CONVOCATIONS_${fileDateLabel}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setExportError(
        `Impossible de générer l'image (le message a bien été copié, tu peux quand même l'envoyer). ${e instanceof Error ? e.message : ""}`
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={handleTrigger} className={triggerClassName}>
        {copied ? "Copié !" : "Copier le message du dimanche"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-[1400px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center gap-3 px-4 h-14 border-b border-line shrink-0 flex-wrap">
              <div className="text-[13px] font-bold text-green">
                {copyFailed ? "Visuel de convocation prêt (copie du message indisponible)" : "Message copié — visuel de convocation prêt"}
              </div>
              <span className="flex-1" />
              <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                className="h-9 px-3.5 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] disabled:opacity-60"
              >
                {exporting ? "Génération…" : "Télécharger l'image"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="h-9 px-3.5 rounded-md border border-line text-[12.5px] font-semibold text-ink-soft hover:border-ink">
                Fermer
              </button>
            </div>

            {data.anomalies.length > 0 && (
              <div className="mx-4 mt-3 bg-red-bg border border-red/30 rounded-md p-3 text-[12.5px] text-red shrink-0">
                <div className="font-bold mb-1">{data.anomalies.length} point{data.anomalies.length > 1 ? "s" : ""} à vérifier avant l&apos;envoi</div>
                <ul className="list-disc pl-4 flex flex-col gap-0.5">
                  {data.anomalies.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {exportError && <div className="mx-4 mt-3 text-[12.5px] text-red shrink-0">{exportError}</div>}

            <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-[#F1F1EE]">
              <div
                style={{
                  width: naturalSize ? naturalSize.w * scale : POSTER_WIDTH,
                  height: naturalSize ? naturalSize.h * scale : undefined,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: POSTER_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <ConvocationPoster ref={posterRef} data={data} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
