import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { POSITIONS } from "@/lib/constants";
import { createPlayer } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function NouveauJoueurPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/joueurs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les joueurs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouveau joueur</div>
        {teams.length === 0 ? (
          <div className="text-[13px] text-muted">Aucune équipe autorisée pour votre compte.</div>
        ) : (
          <form action={createPlayer} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <input name="firstName" required className={inputClass} />
              </Field>
              <Field label="Nom">
                <input name="lastName" required className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Équipe">
                <select name="teamId" required className={inputClass}>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.code}</option>
                  ))}
                </select>
              </Field>
              <Field label="Année de naissance">
                <input type="number" name="birthYear" required defaultValue={2014} className={inputClass} />
              </Field>
            </div>
            <Field label="Poste principal (optionnel)">
              <select name="position" defaultValue="Non renseigné" className={inputClass}>
                <option value="Non renseigné">Non renseigné</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Arrivée au club (optionnel)">
              <input name="joinedLabel" placeholder="Saison 2026/2027" className={inputClass} />
            </Field>
            <button
              type="submit"
              className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
            >
              Ajouter le joueur
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">{label}</span>
      {children}
    </label>
  );
}
