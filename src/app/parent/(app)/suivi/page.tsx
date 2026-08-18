import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ObjectiveCard } from "@/components/parent/ObjectiveCard";

const FEELINGS = ["😩", "😕", "😐", "🙂", "😄"];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function ParentSuiviPage() {
  const parent = await requireParentReady();

  const [player, objectives, feedbacks] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: parent.playerId } }),
    // Uniquement les objectifs publiés explicitement par le staff — jamais
    // automatique. Titre/catégorie/statut/échéance seulement : les notes du
    // coach, la parole du joueur en entretien et les décisions internes ne
    // sortent jamais de cette table.
    prisma.playerObjective.findMany({
      where: { playerId: parent.playerId, visibleToPlayer: true },
      select: { id: true, title: true, category: true, status: true, targetDate: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sessionFeedback.findMany({
      where: { playerId: parent.playerId, OR: [{ preAnsweredAt: { not: null } }, { postAnsweredAt: { not: null } }] },
      include: { session: true },
      orderBy: { session: { date: "desc" } },
      take: 5,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title={`Suivi de ${player.firstName}`} />

      <div>
        <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mb-2">Mes objectifs</div>
        <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
          {objectives.length > 0 ? (
            objectives.map((o) => <ObjectiveCard key={o.id} title={o.title} category={o.category} status={o.status} targetDate={o.targetDate} />)
          ) : (
            <div className="px-4 py-6 text-center text-[13.5px] text-[#8A8D93]">Aucun objectif publié pour le moment.</div>
          )}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mb-2">Mes derniers ressentis</div>
        <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
          {feedbacks.length > 0 ? (
            feedbacks.map((f) => (
              <div key={f.id} className="px-4 py-3.5 border-t border-[#EFEFEC] first:border-t-0">
                <div className="text-[12.5px] font-bold text-[#6E7178]">
                  {DAY_NAMES[f.session.date.getDay()][0].toUpperCase()}
                  {DAY_NAMES[f.session.date.getDay()].slice(1)} {f.session.date.getDate()} {MONTHS[f.session.date.getMonth()]}
                </div>
                <div className="flex items-center gap-5 mt-2">
                  {f.preFeeling && (
                    <div>
                      <div className="text-[10.5px] text-[#9A9DA3] font-semibold">Avant</div>
                      <div className="text-[18px] mt-0.5">{FEELINGS[f.preFeeling - 1]}</div>
                    </div>
                  )}
                  {f.postFeeling && (
                    <div>
                      <div className="text-[10.5px] text-[#9A9DA3] font-semibold">Après</div>
                      <div className="text-[18px] mt-0.5">{FEELINGS[f.postFeeling - 1]}</div>
                    </div>
                  )}
                  {f.rpe && (
                    <div>
                      <div className="text-[10.5px] text-[#9A9DA3] font-semibold">Difficulté</div>
                      <div className="text-[15px] font-bold mt-0.5">{f.rpe} / 10</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[13.5px] text-[#8A8D93]">Aucun ressenti renseigné pour le moment.</div>
          )}
        </div>
      </div>
    </div>
  );
}
