import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { ImportPreviewClient } from "./ImportPreviewClient";

export default async function ImporterJoueursPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; skipped?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const teams = (scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id))).map((t) => ({ id: t.id, code: t.code }));

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/joueurs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les joueurs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-2">Importer des joueurs</div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Fichier <strong>.csv</strong> ou <strong>.xlsx</strong> avec une ligne d&apos;en-tête. Colonnes attendues :{" "}
          <strong>Nom</strong>, <strong>Prénom</strong> — Équipe (code, ex. &quot;U8A&quot;), Année de naissance et Poste
          sont optionnels. Fonctionne avec un export du bouton &quot;Exporter CSV&quot; de l&apos;écran Joueurs.
        </div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Si le fichier n&apos;a pas de colonne Équipe (ou qu&apos;elle est vide sur certaines lignes), choisissez une
          équipe par défaut ci-dessous. Le fichier est d&apos;abord analysé — vous voyez chaque ligne (doublons
          potentiels y compris) avant de confirmer l&apos;import.
        </div>

        {sp.error && <div className="mb-3 px-3 py-2 rounded-md bg-red-bg text-red text-[12.5px] font-medium">{sp.error}</div>}
        {sp.imported !== undefined && (
          <div className="mb-3 px-3 py-2 rounded-md bg-green-bg text-green text-[12.5px] font-medium">
            {sp.imported} joueur{Number(sp.imported) > 1 ? "s" : ""} importé{Number(sp.imported) > 1 ? "s" : ""}
            {Number(sp.skipped) > 0 ? ` · ${sp.skipped} ligne(s) non retenue(s)` : ""}.
          </div>
        )}

        <ImportPreviewClient teams={teams} />
      </div>
    </div>
  );
}
