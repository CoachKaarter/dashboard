import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, canManageCategory } from "@/lib/authz";
import { createMatch } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function NouveauMatchPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  // Creating a fixture needs Responsable-level coverage of the team's
  // category (or the ADMIN technical role) — a Coach-only team never
  // appears here, mirroring createMatch's own server-side check.
  const isAdmin = user.role === "ADMIN";
  const teams = (scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id))).filter(
    (t) => isAdmin || canManageCategory(user, t.category)
  );

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/matchs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les matchs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouveau match</div>
        {teams.length === 0 ? (
          <div className="text-[12.5px] text-muted-2 py-2">
            Aucune équipe pour laquelle vous êtes Responsable de catégorie — seul un Responsable peut créer un match.
          </div>
        ) : (
        <form action={createMatch} className="flex flex-col gap-3.5">
          <Field label="Équipe">
            <select name="teamId" required className={inputClass}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Adversaire (optionnel)">
            <input name="opponent" placeholder="À définir" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Compétition">
              <select name="competition" defaultValue="Championnat" className={inputClass}>
                <option value="Championnat">Championnat</option>
                <option value="Amical">Amical</option>
                <option value="Tournoi">Tournoi</option>
                <option value="Coupe">Coupe</option>
                <option value="Plateau">Plateau</option>
                <option value="Autre">Autre</option>
              </select>
            </Field>
            <Field label="Joueurs requis">
              <input type="number" name="needed" defaultValue={12} min={7} max={16} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" name="date" required className={inputClass} />
            </Field>
            <Field label="Heure">
              <input type="time" name="time" className={inputClass} />
            </Field>
          </div>
          <Field label="Lieu">
            <input name="location" placeholder="Terrain" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" name="isHome" defaultChecked className="w-4 h-4" />
            Match à domicile
          </label>
          <button
            type="submit"
            className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
          >
            Créer le match
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
