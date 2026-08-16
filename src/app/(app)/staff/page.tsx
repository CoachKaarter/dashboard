import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";

const GRID = "grid-cols-[minmax(190px,1.2fr)_170px_180px_170px_160px]";

export default async function StaffPage() {
  const staff = await prisma.user.findMany({
    include: { teams: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-[1300px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className={`grid ${GRID} gap-3 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div>Membre</div>
          <div>Rôle</div>
          <div>Équipes autorisées</div>
          <div>Niveau d&apos;accès</div>
          <div>Contact</div>
        </div>
        {staff.map((s) => (
          <div key={s.id} className={`grid ${GRID} gap-3 px-3.5 h-[42px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px]`}>
            <div className="font-semibold">{s.name}</div>
            <div className="text-ink-soft">{s.jobTitle}</div>
            <div className="text-ink-soft">{s.teams.length ? s.teams.map((t) => t.code).join(", ") : "U12 et U13 — toutes"}</div>
            <div>
              <Badge tone={s.role === "ADMIN" ? "green" : "blue"}>{s.accessLabel}</Badge>
            </div>
            <div className="font-mono text-muted">{s.email}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
