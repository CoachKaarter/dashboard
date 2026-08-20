import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { Badge } from "@/components/ui/Badge";
import { TeamChip } from "@/components/ui/TeamChip";
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_LABELS } from "@/lib/announcement-validation";
import { createAnnouncement, deleteAnnouncement } from "./actions";

const CATEGORY_TONE: Record<string, "orange" | "red" | "blue" | "neutral"> = {
  TERRAIN: "orange",
  ANNULATION: "red",
  WEEKEND: "blue",
  MESSAGE: "neutral",
};

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";
const textareaClass = inputClass + " h-auto py-2 resize-y";

export default async function AnnoncesPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const teamWhere = scope === "ALL" ? {} : { id: { in: scope } };

  let allowedCategories: string[] = ["U12", "U13"];
  if (scope !== "ALL") {
    const scopedTeams = await prisma.team.findMany({ where: { id: { in: scope } }, select: { category: true } });
    allowedCategories = [...new Set(scopedTeams.map((t) => t.category))];
  }

  const [announcements, teams] = await Promise.all([
    prisma.staffAnnouncement.findMany({
      where:
        scope === "ALL"
          ? {}
          : { OR: [{ scopeTeamId: { in: scope } }, { scopeTeamId: null, targetCategory: { in: allowedCategories } }] },
      include: { author: true, scopeTeam: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.team.findMany({ where: teamWhere, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="max-w-[900px] mx-auto animate-fadein">
      <div className="mb-3.5">
        <div className="text-lg font-bold tracking-[-0.01em]">Annonces famille</div>
        <div className="text-[12.5px] text-muted mt-0.5">Publié dans l&apos;onglet &quot;Infos&quot; de l&apos;Espace Parents.</div>
      </div>

      <details className="bg-surface border border-line rounded-lg mb-3.5">
        <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold text-muted hover:text-ink select-none">
          + Nouvelle annonce
        </summary>
        <form action={createAnnouncement} className="px-3.5 pb-3.5 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-muted">Catégorie</span>
              <select name="category" defaultValue="MESSAGE" className={inputClass}>
                {ANNOUNCEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ANNOUNCEMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-muted">Catégorie ciblée</span>
              <select name="targetCategory" defaultValue="U13" className={inputClass}>
                <option value="U12">U12</option>
                <option value="U13">U13</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] text-muted">Équipe précise (facultatif — sinon toute la catégorie)</span>
            <select name="scopeTeamId" defaultValue="" className={inputClass}>
              <option value="">Toute la catégorie</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] text-muted">Titre</span>
            <input name="title" required placeholder="ex. Entraînement du 25 août sur le terrain 3" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] text-muted">Message</span>
            <textarea name="body" required rows={3} placeholder="ex. Le terrain 1 est réservé pour les seniors…" className={textareaClass} />
          </label>
          <button type="submit" className="self-start h-9 px-3 border-none rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
            Publier
          </button>
        </form>
      </details>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {announcements.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-3.5 py-3 border-b border-line-soft-2 last:border-b-0">
            <Badge tone={CATEGORY_TONE[a.category] ?? "neutral"}>{ANNOUNCEMENT_CATEGORY_LABELS[a.category as keyof typeof ANNOUNCEMENT_CATEGORY_LABELS] ?? a.category}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{a.title}</div>
              <div className="text-[12px] text-ink-soft mt-0.5">{a.body}</div>
              <div className="text-[11px] text-muted-2 mt-1 flex items-center gap-1.5">
                {a.author.name} · {a.createdAt.toLocaleDateString("fr-FR")}
                {a.scopeTeam ? <TeamChip code={a.scopeTeam.code} /> : <span>· {a.targetCategory}</span>}
              </div>
            </div>
            <form action={deleteAnnouncement.bind(null, a.id)}>
              <button type="submit" className="h-7 px-2 border border-line rounded-md text-[11px] font-semibold text-red hover:border-red">
                Supprimer
              </button>
            </form>
          </div>
        ))}
        {announcements.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucune annonce pour l&apos;instant.</div>}
      </div>
    </div>
  );
}
