import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { formatDateShort } from "@/lib/format";

export default async function JournalPage() {
  await requireAdmin();
  const entries = await prisma.activityLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="max-w-[1000px] mx-auto animate-fadein">
      <div className="text-lg font-bold tracking-[-0.01em] mb-1">Journal d&apos;activité</div>
      <div className="text-[12.5px] text-muted mb-3.5">Les 200 dernières actions du staff sur les données du club.</div>
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted text-[13px]">Aucune action enregistrée pour l&apos;instant.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0 text-[12.5px]">
              <span className="font-mono text-muted-2 w-[120px] shrink-0">
                {formatDateShort(e.createdAt)} {e.createdAt.toTimeString().slice(0, 5)}
              </span>
              <span className="font-semibold w-[110px] shrink-0 truncate">{e.actor?.name ?? "Système"}</span>
              <span className="text-ink-soft">{e.summary}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
