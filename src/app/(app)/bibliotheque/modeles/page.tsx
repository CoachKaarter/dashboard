import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Badge } from "@/components/ui/Badge";
import { archiveTemplate } from "../template-actions";
import type { Prisma } from "@/generated/prisma/client";

export default async function ModelesPage() {
  const user = await requireUser();
  const scopeWhere: Prisma.SessionTemplateWhereInput =
    user.role === "ADMIN" ? {} : { OR: [{ visibility: "SHARED" }, { createdById: user.id }] };

  const templates = await prisma.sessionTemplate.findMany({
    where: { archived: false, ...scopeWhere },
    include: { createdBy: true, _count: { select: { blocks: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="max-w-[900px] mx-auto animate-fadein">
      <Link href="/bibliotheque" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Bibliothèque
      </Link>
      <div className="mb-3.5">
        <div className="text-lg font-bold tracking-[-0.01em]">Modèles de séance</div>
        <div className="text-muted text-[12.5px] mt-0.5">Structures complètes réutilisables, préparées depuis un Session Studio.</div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-3.5 h-[46px] border-b border-line-soft-2 last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[12.5px] truncate">{t.name}</div>
              <div className="text-[11px] text-muted truncate">
                {t._count.blocks} bloc{t._count.blocks > 1 ? "s" : ""} · {t.createdBy.name}
              </div>
            </div>
            {t.visibility === "SHARED" && <Badge tone="green">Partagé</Badge>}
            <form action={archiveTemplate.bind(null, t.id, true)}>
              <button type="submit" className="h-7 px-2 border border-line rounded-md text-[11px] font-semibold text-muted hover:border-red hover:text-red">
                Archiver
              </button>
            </form>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="px-4 py-10 text-center text-muted text-[13px]">
            Aucun modèle pour l&apos;instant — créez-en un depuis le Session Studio d&apos;une séance (&quot;Sauvegarder comme modèle&quot;).
          </div>
        )}
      </div>
    </div>
  );
}
