import Link from "next/link";
import { importPlayers } from "../actions";

export default async function ImporterJoueursPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; skipped?: string; error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/joueurs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les joueurs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-2">Importer des joueurs (CSV)</div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Fichier CSV avec une ligne d&apos;en-tête. Colonnes attendues : <strong>Nom</strong>, <strong>Prénom</strong>,{" "}
          <strong>Équipe</strong> (code, ex. &quot;U13A&quot;) — Catégorie, Année de naissance et Poste sont optionnels.
          Fonctionne avec un export du bouton &quot;Exporter CSV&quot; de l&apos;écran Joueurs.
        </div>

        {sp.error && (
          <div className="mb-3 px-3 py-2 rounded-md bg-red-bg text-red text-[12.5px] font-medium">{sp.error}</div>
        )}
        {sp.imported !== undefined && (
          <div className="mb-3 px-3 py-2 rounded-md bg-green-bg text-green text-[12.5px] font-medium">
            {sp.imported} joueur{Number(sp.imported) > 1 ? "s" : ""} importé{Number(sp.imported) > 1 ? "s" : ""}
            {Number(sp.skipped) > 0 ? ` · ${sp.skipped} ligne(s) ignorée(s) (équipe inconnue ou non autorisée)` : ""}.
          </div>
        )}

        <form action={importPlayers} className="flex flex-col gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-[12.5px] file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-line file:bg-[#FCFCFB] file:text-xs file:font-semibold file:cursor-pointer"
          />
          <button type="submit" className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer hover:bg-[#2A2E36]">
            Importer
          </button>
        </form>
      </div>
    </div>
  );
}
