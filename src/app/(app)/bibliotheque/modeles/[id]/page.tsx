import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Badge } from "@/components/ui/Badge";
import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { canViewTemplate } from "@/lib/training-content-scope";

export default async function ModeleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const template = await prisma.sessionTemplate.findUnique({
    where: { id },
    include: { blocks: { orderBy: { order: "asc" } }, createdBy: true },
  });
  if (!template) notFound();
  if (!canViewTemplate(user, template)) notFound();

  const totalMinutes = template.blocks.reduce((n, b) => n + b.durationMinutes, 0);

  return (
    <div className="max-w-[700px] mx-auto animate-fadein">
      <Link href="/bibliotheque/modeles" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Modèles
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5 mb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-lg font-bold tracking-[-0.01em]">{template.name}</div>
          {template.visibility === "SHARED" && <Badge tone="green">Partagé</Badge>}
        </div>
        {template.description && <div className="text-[12.5px] text-muted">{template.description}</div>}
        <div className="text-[11.5px] text-muted mt-1.5">
          {template.createdBy.name} · {template.blocks.length} bloc{template.blocks.length > 1 ? "s" : ""} · {totalMinutes} min au total
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {template.blocks.map((b, i) => (
          <div key={b.id} className="flex items-center gap-2.5 px-3.5 h-11 border-b border-line-soft-2 last:border-b-0">
            <span className="font-mono text-[11px] text-muted-2 w-4">{i + 1}</span>
            <span className="text-[10.5px] font-bold tracking-[0.05em] uppercase text-muted">{SESSION_BLOCK_TYPE_LABELS[b.type] ?? b.type}</span>
            <span className="text-[12.5px] font-semibold flex-1 truncate">{b.title}</span>
            <span className="font-mono text-[11.5px] text-muted">{b.durationMinutes}&apos;</span>
          </div>
        ))}
      </div>
    </div>
  );
}
