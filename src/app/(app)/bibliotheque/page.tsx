import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { QuerySelect } from "@/components/ui/QuerySelect";
import { TextFilter } from "@/components/ui/TextFilter";
import { Badge } from "@/components/ui/Badge";
import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { FavoriteButton } from "./FavoriteButton";
import type { Prisma } from "@/generated/prisma/client";

const SORTS: Record<string, Prisma.TrainingContentItemOrderByWithRelationInput> = {
  recent: { createdAt: "desc" },
  modified: { updatedAt: "desc" },
  alpha: { title: "asc" },
  used: { sessionBlocks: { _count: "desc" } },
};

const PAGE_SIZE = 40;

export default async function BibliothequePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; tag?: string; fav?: string; format?: string; sort?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type = sp.type && sp.type !== "Tous" ? sp.type : undefined;
  const tag = sp.tag && sp.tag !== "Tous" ? sp.tag : undefined;
  const format = sp.format && sp.format !== "Tous" ? sp.format : undefined;
  const favOnly = sp.fav === "1";
  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : "recent";
  const page = Math.max(1, Number(sp.page) || 1);

  const scopeWhere: Prisma.TrainingContentItemWhereInput =
    user.role === "ADMIN" ? {} : { OR: [{ visibility: "SHARED" }, { createdById: user.id }] };

  const where: Prisma.TrainingContentItemWhereInput = {
    archived: false,
    ...scopeWhere,
    ...(type ? { type } : {}),
    ...(format ? { format } : {}),
    ...(tag ? { tags: { some: { slug: tag } } } : {}),
    ...(favOnly ? { favoritedBy: { some: { userId: user.id } } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { objective: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { coachingPoints: { contains: q, mode: "insensitive" } },
            { tags: { some: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [items, total, tags, favoriteIds] = await Promise.all([
    prisma.trainingContentItem.findMany({
      where,
      include: { tags: true, _count: { select: { sessionBlocks: true } } },
      orderBy: SORTS[sortKey],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.trainingContentItem.count({ where }),
    prisma.trainingContentTag.findMany({ orderBy: { name: "asc" } }),
    prisma.trainingContentFavorite.findMany({ where: { userId: user.id }, select: { contentItemId: true } }),
  ]);
  const favoriteSet = new Set(favoriteIds.map((f) => f.contentItemId));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseParams = { q: sp.q, type: sp.type, tag: sp.tag, fav: sp.fav, format: sp.format, sort: sp.sort };
  const qs = (overrides: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...baseParams, ...overrides })) if (v) usp.set(k, v);
    const s = usp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-fadein">
      <div className="mb-3.5">
        <div className="text-lg font-bold tracking-[-0.01em]">Bibliothèque</div>
        <div className="text-muted text-[12.5px] mt-0.5">Retrouvez et réutilisez vos procédés.</div>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <TextFilter paramKey="q" placeholder="Rechercher un procédé…" />
        <QuerySelect
          paramKey="type"
          options={[{ value: "Tous", label: "Tous les types" }, ...Object.entries(SESSION_BLOCK_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))]}
        />
        <QuerySelect paramKey="tag" options={[{ value: "Tous", label: "Tous les principes" }, ...tags.map((t) => ({ value: t.slug, label: t.name }))]} />
        <QuerySelect
          paramKey="format"
          options={[
            { value: "Tous", label: "Tous formats" },
            { value: "Foot à 5", label: "Foot à 5" },
            { value: "Foot à 8", label: "Foot à 8" },
            { value: "Foot à 11", label: "Foot à 11" },
          ]}
        />
        <Link
          href={qs({ fav: favOnly ? undefined : "1", page: undefined })}
          className={`h-[30px] px-3 rounded-md text-xs font-semibold flex items-center border ${
            favOnly ? "bg-orange-bg border-orange text-orange" : "bg-surface border-line text-muted hover:border-ink hover:text-ink"
          }`}
        >
          ★ Mes favoris
        </Link>
        <QuerySelect
          paramKey="sort"
          options={[
            { value: "recent", label: "Récents" },
            { value: "used", label: "Plus utilisés" },
            { value: "alpha", label: "Alphabétique" },
            { value: "modified", label: "Dernière modification" },
          ]}
        />
        <span className="flex-1" />
        <div className="font-mono text-[11.5px] text-muted">{total} procédé{total > 1 ? "s" : ""}</div>
        <Link
          href="/bibliotheque/modeles"
          className="h-8 px-3 border border-line rounded-md bg-[#FCFCFB] text-xs font-semibold text-ink-soft flex items-center hover:border-ink hover:text-ink"
        >
          Modèles de séance
        </Link>
        <Link
          href="/bibliotheque/nouveau"
          className="h-8 px-3 border-none rounded-md bg-ink text-white text-xs font-semibold flex items-center hover:bg-[#2A2E36]"
        >
          + Nouveau procédé
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {items.map((item) => (
          <div key={item.id} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2 hover:border-ink transition-colors">
            <div className="flex items-center justify-between">
              <Badge tone="blue">{SESSION_BLOCK_TYPE_LABELS[item.type] ?? item.type}</Badge>
              <FavoriteButton contentItemId={item.id} active={favoriteSet.has(item.id)} />
            </div>
            <Link href={`/bibliotheque/${item.id}`} className="font-semibold text-[13.5px] leading-tight hover:underline">
              {item.title}
            </Link>
            {item.objective && <div className="text-[12px] text-muted line-clamp-2">{item.objective}</div>}
            <div className="flex items-center gap-2.5 text-[11px] text-muted-2 font-mono">
              {item.defaultDurationMinutes && <span>{item.defaultDurationMinutes}&apos;</span>}
              {(item.minPlayers || item.maxPlayers) && (
                <span>
                  {item.minPlayers ?? "?"}–{item.maxPlayers ?? "?"} joueurs
                </span>
              )}
              {item._count.sessionBlocks > 0 && <span>utilisé {item._count.sessionBlocks}×</span>}
            </div>
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 4).map((t) => (
                  <span key={t.id} className="text-[10.5px] px-1.5 py-0.5 rounded bg-bg text-muted-2 font-medium">
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full px-4 py-10 text-center text-muted text-[13px] border border-dashed border-line rounded-lg">
            Aucun procédé ne correspond à ces filtres.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={qs({ page: p === 1 ? undefined : String(p) })}
              className={`w-7 h-7 rounded-md text-[11.5px] font-semibold flex items-center justify-center border ${
                p === page ? "bg-ink text-white border-ink" : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
