import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, getManageableCategories } from "@/lib/authz";
import { createSession } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function NouvelleSeancePage() {
  const user = await requireUser();
  const categories = await getManageableCategories(user);
  const teams = await prisma.team.findMany({
    where: { category: { in: categories } },
    orderBy: { code: "asc" },
  });

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/seances" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Toutes les séances
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouvelle séance</div>
        <form action={createSession} className="flex flex-col gap-3.5">
          <Field label="Catégorie">
            <select name="category" defaultValue={categories[0] ?? ""} className={inputClass}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Équipe spécifique (optionnel)">
            <select name="scopeTeamId" defaultValue="" className={inputClass}>
              <option value="">Toute la catégorie</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Intitulé">
            <input name="label" defaultValue="Séance commune" required className={inputClass} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" name="date" required className={inputClass} />
            </Field>
            <Field label="Début">
              <input type="time" name="startTime" defaultValue="18:15" required className={inputClass} />
            </Field>
            <Field label="Fin">
              <input type="time" name="endTime" defaultValue="19:45" required className={inputClass} />
            </Field>
          </div>
          <Field label="Terrain">
            <input name="location" defaultValue="Gripots 1" required className={inputClass} />
          </Field>
          <Field label="Thème (optionnel)">
            <input name="theme" placeholder="Conservation du ballon" className={inputClass} />
          </Field>
          <Field label="Objectif pédagogique (optionnel)">
            <input name="objective" placeholder="Jouer sous pression en 2 touches" className={inputClass} />
          </Field>
          <button
            type="submit"
            className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
          >
            Créer la séance
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
