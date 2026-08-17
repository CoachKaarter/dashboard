import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/authz";

const GRID = "grid-cols-[minmax(190px,1.2fr)_170px_180px_170px_160px_80px]";

export default async function StaffPage() {
  await requireAdmin();
  const [staff, teams] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);
  const teamCodeById = new Map(teams.map((t) => [t.id, t.code]));

  return (
    <div className="max-w-[1300px] mx-auto animate-fadein">
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[13px] text-muted">{staff.length} comptes</div>
        <Link
          href="/staff/nouveau"
          className="h-8 px-3 border border-line rounded-md bg-[#FCFCFB] text-xs font-semibold text-ink-soft flex items-center hover:border-ink hover:text-ink"
        >
          + Nouveau compte
        </Link>
      </div>
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className={`grid ${GRID} gap-3 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div>Membre</div>
          <div>Rôle</div>
          <div>Équipes autorisées</div>
          <div>Niveau d&apos;accès</div>
          <div>Contact</div>
          <div></div>
        </div>
        {staff.map((s) => (
          <Link
            key={s.id}
            href={`/staff/${s.id}`}
            className={`grid ${GRID} gap-3 px-3.5 h-[42px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px] hover:bg-bg/60`}
          >
            <div className="font-semibold flex items-center gap-2">
              {s.name}
              {!s.active && <Badge tone="red">Désactivé</Badge>}
            </div>
            <div className="text-ink-soft">{s.jobTitle}</div>
            <div className="text-ink-soft">
              {s.role === "ADMIN"
                ? "Toutes (admin)"
                : s.teamIds.length
                  ? s.teamIds.map((id) => teamCodeById.get(id) ?? "?").join(", ")
                  : "Aucune"}
            </div>
            <div>
              <Badge tone={s.role === "ADMIN" ? "green" : "blue"}>{s.accessLabel}</Badge>
            </div>
            <div className="font-mono text-muted">{s.email}</div>
            <div className="text-right text-[#C9CBC7]">›</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
