import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@/lib/format";

const GRID = "grid-cols-[84px_76px_minmax(190px,1fr)_110px_110px_96px_96px]";
const CONDITION_TONE: Record<string, "green" | "orange" | "red"> = { Bon: "green", "À laver": "orange", Abîmé: "red" };

export default async function MaterielPage() {
  const jerseys = await prisma.jersey.findMany({ include: { team: true }, orderBy: { issuedDate: "desc" } });
  const now = new Date();

  return (
    <div className="max-w-[1500px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className={`grid ${GRID} gap-3 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div>Sac</div>
          <div>Équipe</div>
          <div>Responsable</div>
          <div>Retour prévu</div>
          <div>Retour réel</div>
          <div>État</div>
          <div>Retard</div>
        </div>
        {jerseys.map((j) => {
          const retard = !j.returnedDate && j.dueDate < now ? Math.round((now.getTime() - j.dueDate.getTime()) / 86400000) : 0;
          return (
            <div key={j.id} className={`grid ${GRID} gap-3 px-3.5 h-[42px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px]`}>
              <div className="font-mono text-muted">{j.code}</div>
              <div>
                <TeamChip code={j.team.code} />
              </div>
              <div className="font-semibold">{j.responsible}</div>
              <div className="font-mono">{formatDateShort(j.dueDate)}</div>
              <div className={`font-mono ${j.returnedDate ? "" : "text-red"}`}>{j.returnedDate ? formatDateShort(j.returnedDate) : "—"}</div>
              <div>
                <Badge tone={CONDITION_TONE[j.condition] ?? "neutral"}>{j.condition}</Badge>
              </div>
              <div>{retard > 0 ? <Badge tone="red">{retard} jours</Badge> : <span className="font-mono text-muted-2">—</span>}</div>
            </div>
          );
        })}
        {jerseys.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun sac enregistré.</div>}
      </div>
    </div>
  );
}
