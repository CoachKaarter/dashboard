import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { ANNOUNCEMENT_CATEGORY_LABELS } from "@/lib/announcement-validation";

const CATEGORY_ACCENT: Record<string, string> = {
  TERRAIN: "#C97A17",
  ANNULATION: "#C4362C",
  WEEKEND: "#2F6FED",
  MESSAGE: "#16181C",
};

export default async function ParentInfosPage() {
  const parent = await requireParentReady();

  const announcements = await prisma.staffAnnouncement.findMany({
    where: { OR: [{ scopeTeamId: parent.player.teamId }, { scopeTeamId: null, targetCategory: parent.player.teamCategory }] },
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Informations du staff" />

      {announcements.length === 0 && (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Aucune information pour l&apos;instant.</div>
        </ParentCard>
      )}

      {announcements.map((a) => (
        <ParentCard key={a.id} style={{ borderTop: `3px solid ${CATEGORY_ACCENT[a.category] ?? "#9A9DA3"}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase" style={{ color: CATEGORY_ACCENT[a.category] ?? "#9A9DA3" }}>
              {ANNOUNCEMENT_CATEGORY_LABELS[a.category as keyof typeof ANNOUNCEMENT_CATEGORY_LABELS] ?? a.category}
            </span>
            <span className="text-[11.5px] text-[#9A9DA3]">{a.createdAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          <div className="text-[15px] font-bold mt-1.5">{a.title}</div>
          <div className="text-[13.5px] text-[#6E7178] mt-1 leading-relaxed">{a.body}</div>
          <div className="text-[12px] text-[#9A9DA3] mt-2">
            {a.author.name} — {a.author.jobTitle}
          </div>
        </ParentCard>
      ))}
    </div>
  );
}
