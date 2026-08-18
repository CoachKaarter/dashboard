import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { Badge } from "@/components/ui/Badge";
import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { canEditContentItem, canViewContentItem } from "@/lib/training-content-scope";
import { archiveContentItem, duplicateContentItem } from "../actions";
import { FavoriteButton } from "../FavoriteButton";
import { AddToSessionButton } from "../AddToSessionButton";

export default async function ProcedeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const item = await prisma.trainingContentItem.findUnique({
    where: { id },
    include: { tags: true, createdBy: true, favoritedBy: { where: { userId: user.id } }, _count: { select: { sessionBlocks: true } } },
  });
  if (!item) notFound();
  if (!canViewContentItem(user, item)) notFound();
  const canEdit = canEditContentItem(user, item);

  return (
    <div className="max-w-[820px] mx-auto animate-fadein">
      <Link href="/bibliotheque" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Bibliothèque
      </Link>

      <div className="bg-surface border border-line rounded-lg p-5 mb-3.5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="blue">{SESSION_BLOCK_TYPE_LABELS[item.type] ?? item.type}</Badge>
            {item.visibility === "SHARED" && <Badge tone="green">Partagé</Badge>}
            {item.archived && <Badge tone="red">Archivé</Badge>}
          </div>
          <FavoriteButton contentItemId={item.id} active={item.favoritedBy.length > 0} />
        </div>
        <div className="text-lg font-bold tracking-[-0.01em]">{item.title}</div>
        <div className="text-[11.5px] text-muted mt-1">
          Créé par {item.createdBy.name} · modifié le {item.updatedAt.toLocaleDateString("fr-FR")}
          {item._count.sessionBlocks > 0 && ` · utilisé ${item._count.sessionBlocks} fois`}
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.map((t) => (
              <span key={t.id} className="text-[10.5px] px-1.5 py-0.5 rounded bg-bg text-muted-2 font-medium">
                {t.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-line-soft flex-wrap">
          <AddToSessionButton contentItemId={item.id} />
          {canEdit && (
            <Link href={`/bibliotheque/${item.id}/modifier`} className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink flex items-center">
              Modifier
            </Link>
          )}
          <form action={duplicateContentItem.bind(null, item.id)}>
            <button type="submit" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink">
              Dupliquer
            </button>
          </form>
          {canEdit && (
            <form action={archiveContentItem.bind(null, item.id, !item.archived)}>
              <button
                type="submit"
                className={`h-8 px-3 border rounded-md text-xs font-semibold ${item.archived ? "border-line text-green hover:border-green" : "border-line text-red hover:border-red"}`}
              >
                {item.archived ? "Restaurer" : "Archiver"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoBlock label="Objectif" value={item.objective} />
        <InfoBlock label="Organisation" value={item.organization} />
        <InfoBlock label="Espace" value={item.space} />
        <InfoBlock label="Matériel" value={item.equipment} />
      </div>
      <InfoBlock label="Consignes" value={item.instructions} className="mt-3" />
      <InfoBlock label="Points de coaching" value={item.coachingPoints} className="mt-3" />
      <InfoBlock label="Variantes" value={item.variations} className="mt-3" />

      <div className="flex items-center gap-4 mt-3.5 text-[12px] text-muted font-mono">
        {item.defaultDurationMinutes && <span>{item.defaultDurationMinutes} min</span>}
        {(item.minPlayers || item.maxPlayers) && (
          <span>
            {item.minPlayers ?? "?"}–{item.maxPlayers ?? "?"} joueurs
          </span>
        )}
        {item.format && <span>{item.format}</span>}
        {item.categories.length > 0 && <span>{item.categories.join(", ")}</span>}
      </div>

      {item.imageUrl && (
        <div className="bg-surface border border-line rounded-lg p-3.5 mt-3.5">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-2">Schéma</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt="Schéma du procédé" className="max-w-full rounded-md border border-line-soft" />
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value, className = "" }: { label: string; value: string | null; className?: string }) {
  if (!value) return null;
  return (
    <div className={`bg-surface border border-line rounded-lg p-3.5 ${className}`}>
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-1.5">{label}</div>
      <div className="text-[12.5px] text-ink-soft whitespace-pre-wrap">{value}</div>
    </div>
  );
}
