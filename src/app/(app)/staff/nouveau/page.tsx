import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { createStaff } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function NouveauStaffPage() {
  await requireAdmin();
  const teams = await prisma.team.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/staff" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Staff
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouveau compte</div>
        <form action={createStaff} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom complet">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Identifiant de connexion">
              <input name="username" required pattern="[a-z0-9._-]+" className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rôle">
              <select name="role" defaultValue="STAFF" className={inputClass}>
                <option value="ADMIN">ADMIN — accès complet</option>
                <option value="COACH">COACH</option>
                <option value="STAFF">STAFF</option>
              </select>
            </Field>
            <Field label="Fonction">
              <input name="jobTitle" required placeholder="Coach, Dirigeant…" className={inputClass} />
            </Field>
          </div>
          <Field label="Niveau d'accès (libellé affiché)">
            <input name="accessLabel" required placeholder="Équipes autorisées" className={inputClass} />
          </Field>
          <Field label="Email (optionnel)">
            <input type="email" name="email" className={inputClass} />
          </Field>
          <div>
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted mb-1.5 block">
              Équipes autorisées (ignoré pour un compte ADMIN)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {teams.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-[12.5px] border border-line rounded-md px-2 h-8">
                  <input type="checkbox" name="teamIds" value={t.id} className="w-3.5 h-3.5" />
                  {t.code}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
          >
            Créer le compte
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
