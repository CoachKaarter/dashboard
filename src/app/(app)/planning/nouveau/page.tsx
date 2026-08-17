import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { createEvent } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function NouvelEvenementPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/planning" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Planning
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouvel événement</div>
        <form action={createEvent} className="flex flex-col gap-3.5">
          <Field label="Titre">
            <input name="title" required placeholder="Réunion staff, tournoi…" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select name="kind" defaultValue="reunion" className={inputClass}>
                <option value="reunion">Réunion</option>
                <option value="tournoi">Tournoi</option>
                <option value="autre">Autre</option>
              </select>
            </Field>
            <Field label="Concerne">
              <select name="teamId" defaultValue="" className={inputClass}>
                <option value="">Toutes les équipes</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.code}</option>
                ))}
              </select>
            </Field>
          </div>
          <input type="hidden" name="teamLabel" value="Toutes" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" name="date" required className={inputClass} />
            </Field>
            <Field label="Début">
              <input type="time" name="startTime" required defaultValue="19:00" className={inputClass} />
            </Field>
            <Field label="Fin">
              <input type="time" name="endTime" required defaultValue="20:00" className={inputClass} />
            </Field>
          </div>
          <Field label="Lieu (optionnel)">
            <input name="location" className={inputClass} />
          </Field>
          <button
            type="submit"
            className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
          >
            Créer l&apos;événement
          </button>
        </form>
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
