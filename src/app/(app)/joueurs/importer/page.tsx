import Link from "next/link";
import { requireUser, getAccessibleCategories } from "@/lib/authz";
import { ImportPreviewClient } from "./ImportPreviewClient";

export default async function ImporterJoueursPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; skipped?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const categories = getAccessibleCategories(user);

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/joueurs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les joueurs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-2">Importer des joueurs</div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Fichier <strong>.csv</strong> ou <strong>.xlsx</strong> avec une ligne d&apos;en-tête. Colonnes attendues :{" "}
          <strong>Nom</strong>, <strong>Prénom</strong> — Catégorie, Année ou Date de naissance, Poste, et contact du
          Parent 1 (prénom/nom/email/téléphone) sont optionnels. Fonctionne avec un export du bouton &quot;Exporter
          CSV&quot; de l&apos;écran Joueurs comme avec un modèle club (colonnes &quot;Nom(Obligatoire)&quot;,
          &quot;Date de naissance&quot;, etc.).
        </div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Un joueur importé n&apos;est jamais rattaché à une équipe précise (U12A/B/C), seulement à sa catégorie —
          l&apos;équipe avec laquelle il joue se détermine ensuite d&apos;elle-même, à partir des matchs qu&apos;il
          dispute. Si le fichier n&apos;a pas de colonne Catégorie (ou qu&apos;elle est vide sur certaines lignes),
          choisissez une catégorie par défaut ci-dessous. Le fichier est d&apos;abord analysé — vous voyez chaque
          ligne (doublons potentiels y compris) avant de confirmer l&apos;import.
        </div>

        {sp.error && <div className="mb-3 px-3 py-2 rounded-md bg-red-bg text-red text-[12.5px] font-medium">{sp.error}</div>}
        {sp.imported !== undefined && (
          <div className="mb-3 px-3 py-2 rounded-md bg-green-bg text-green text-[12.5px] font-medium">
            {sp.imported} joueur{Number(sp.imported) > 1 ? "s" : ""} importé{Number(sp.imported) > 1 ? "s" : ""}
            {Number(sp.skipped) > 0 ? ` · ${sp.skipped} ligne(s) non retenue(s)` : ""}.
          </div>
        )}

        <ImportPreviewClient categories={categories} />
      </div>
    </div>
  );
}
