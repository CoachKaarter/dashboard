import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { importMatches } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function ImporterMatchsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; duplicates?: string; skipped?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/matchs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les matchs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-2">Importer des matchs (Excel)</div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Fichier <strong>.xlsx</strong> avec une ligne d&apos;en-tête. Colonnes attendues : <strong>Adversaire</strong>,{" "}
          <strong>Date du match (dd/mm/yyyy)</strong> — Équipe, Heure de début, Heure de fin et Lieu sont optionnels.
          Fonctionne avec l&apos;export de calendrier fourni par le district/la ligue.
        </div>
        <div className="text-[12.5px] text-muted mb-4 leading-relaxed">
          Si le fichier a une colonne <strong>Equipe</strong> (ex. &quot;U12A&quot;), chaque ligne est rattachée à
          l&apos;équipe qu&apos;elle indique. Sinon, toutes les lignes sont rattachées à l&apos;équipe choisie ci-dessous.
          Un match sans lieu renseigné est importé comme match à l&apos;extérieur (à corriger au besoin après import) ;
          une ligne dont l&apos;adversaire contient &quot;Tournoi&quot; est importée en compétition Tournoi.
        </div>

        {sp.error && <div className="mb-3 px-3 py-2 rounded-md bg-red-bg text-red text-[12.5px] font-medium">{sp.error}</div>}
        {sp.imported !== undefined && (
          <div className="mb-3 px-3 py-2 rounded-md bg-green-bg text-green text-[12.5px] font-medium">
            {sp.imported} match{Number(sp.imported) > 1 ? "s" : ""} importé{Number(sp.imported) > 1 ? "s" : ""}
            {Number(sp.duplicates) > 0 ? ` · ${sp.duplicates} déjà existant(s) ignoré(s)` : ""}
            {Number(sp.skipped) > 0 ? ` · ${sp.skipped} ligne(s) ignorée(s) (date ou équipe invalide)` : ""}.
          </div>
        )}

        <form action={importMatches} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Équipe par défaut (si pas de colonne Equipe)</span>
            <select name="teamId" defaultValue="" className={inputClass}>
              <option value="">— Aucune (fichier avec colonne Equipe) —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Compétition par défaut</span>
              <select name="competition" defaultValue="Championnat" className={inputClass}>
                <option value="Championnat">Championnat</option>
                <option value="Amical">Amical</option>
                <option value="Tournoi">Tournoi</option>
                <option value="Coupe">Coupe</option>
                <option value="Plateau">Plateau</option>
                <option value="Autre">Autre</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Joueurs requis</span>
              <input type="number" name="needed" defaultValue={12} min={7} max={16} className={inputClass} />
            </label>
          </div>
          <input
            type="file"
            name="file"
            accept=".xlsx"
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
