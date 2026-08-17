import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { Badge } from "@/components/ui/Badge";
import { updateStaff, setActive, resetPassword } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tempPassword?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { tempPassword } = await searchParams;
  const [user, teams] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);
  if (!user) notFound();

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/staff" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Staff
      </Link>

      {tempPassword && (
        <div className="bg-orange-bg border border-orange rounded-lg px-4 py-3 mb-3.5 text-[13px]">
          <div className="font-semibold text-orange mb-1">Mot de passe temporaire généré</div>
          <div className="font-mono text-[14px] font-bold">{tempPassword}</div>
          <div className="text-muted text-[11.5px] mt-1">
            Communique-le à {user.name} en dehors de cette page — il n&apos;est affiché qu&apos;une seule fois.
          </div>
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg p-5 mb-3.5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-lg font-bold tracking-[-0.01em]">{user.name}</div>
          <Badge tone={user.active ? "green" : "red"}>{user.active ? "Actif" : "Désactivé"}</Badge>
        </div>
        <form action={updateStaff.bind(null, id)} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom complet">
              <input name="name" required defaultValue={user.name} className={inputClass} />
            </Field>
            <Field label="Identifiant">
              <input value={user.username} disabled className={inputClass + " opacity-60"} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rôle">
              <select name="role" defaultValue={user.role} className={inputClass}>
                <option value="ADMIN">ADMIN — accès complet</option>
                <option value="COACH">COACH</option>
                <option value="STAFF">STAFF</option>
              </select>
            </Field>
            <Field label="Fonction">
              <input name="jobTitle" required defaultValue={user.jobTitle} className={inputClass} />
            </Field>
          </div>
          <Field label="Niveau d'accès (libellé affiché)">
            <input name="accessLabel" required defaultValue={user.accessLabel} className={inputClass} />
          </Field>
          <Field label="Email">
            <input type="email" name="email" defaultValue={user.email ?? ""} className={inputClass} />
          </Field>
          <div>
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted mb-1.5 block">
              Équipes autorisées (ignoré pour un compte ADMIN)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {teams.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-[12.5px] border border-line rounded-md px-2 h-8">
                  <input type="checkbox" name="teamIds" value={t.id} defaultChecked={user.teamIds.includes(t.id)} className="w-3.5 h-3.5" />
                  {t.code}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]">
            Enregistrer
          </button>
        </form>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Accès au compte</div>
        <form action={resetPassword.bind(null, id)}>
          <button type="submit" className="h-9 w-full border border-line rounded-md text-[12.5px] font-semibold text-ink-soft hover:border-ink hover:text-ink">
            Réinitialiser le mot de passe
          </button>
        </form>
        {user.id !== admin.id && (
          <form action={setActive.bind(null, id, !user.active)}>
            <button
              type="submit"
              className={`h-9 w-full border rounded-md text-[12.5px] font-semibold ${
                user.active ? "border-line text-red hover:border-red" : "border-line text-green hover:border-green"
              }`}
            >
              {user.active ? "Désactiver ce compte" : "Réactiver ce compte"}
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
