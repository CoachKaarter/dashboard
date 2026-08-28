import { prisma } from "@/lib/prisma";
import { requireParentReady } from "@/lib/parent-guard";
import { getClub } from "@/lib/club";
import { computePlayerCardRating, abbreviatePosition } from "@/lib/player-card";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";

export default async function ParentCartePage() {
  const parent = await requireParentReady();

  const [player, club] = await Promise.all([
    prisma.player.findUniqueOrThrow({
      where: { id: parent.playerId },
      include: { team: true, evaluations: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    getClub(),
  ]);

  const rating = computePlayerCardRating(player.evaluations[0] ?? null);
  const initials = `${player.firstName[0]}${player.lastName[0]}`.toUpperCase();

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Carte joueur" subtitle={`${player.firstName} ${player.lastName}`} backHref="/parent/suivi" backLabel="Suivi" />

      {!rating ? (
        <ParentCard>
          <div className="text-center py-6">
            <div className="text-[15px] font-bold" style={{ fontFamily: "var(--font-parent-display)" }}>
              Pas encore de carte
            </div>
            <div className="text-[13px] text-[#8A8D93] mt-1.5 max-w-[280px] mx-auto">
              La carte apparaît dès la première évaluation du coach ce trimestre.
            </div>
          </div>
        </ParentCard>
      ) : (
        <div
          className="w-full max-w-[300px] mx-auto rounded-[24px] px-5 pt-5 pb-6 text-white relative shadow-[0_12px_32px_rgba(0,0,0,0.22)]"
          style={{ background: "linear-gradient(160deg, var(--club-primary) 0%, var(--club-secondary) 100%)" }}
        >
          <div className="absolute top-5 left-5">
            <div
              className="font-mono text-[46px] font-black leading-[0.85] tracking-[-0.03em]"
              style={{ fontFamily: "var(--font-parent-display)" }}
            >
              {rating.overall}
            </div>
            <div className="text-[13px] font-bold tracking-[0.06em] mt-1">{abbreviatePosition(player.position)}</div>
          </div>

          {club.shortName && (
            <div className="absolute top-5 right-5 text-[10.5px] font-bold tracking-[0.1em] opacity-70 uppercase">{club.shortName}</div>
          )}

          <div className="flex flex-col items-center pt-9 pb-3">
            <div className="w-24 h-24 rounded-full bg-white/12 border-2 border-white/35 flex items-center justify-center">
              <span className="text-[30px] font-black" style={{ fontFamily: "var(--font-parent-display)" }}>
                {initials}
              </span>
            </div>
            <div className="text-[19px] font-bold tracking-[-0.01em] mt-3 text-center leading-tight" style={{ fontFamily: "var(--font-parent-display)" }}>
              {player.firstName}
              <br />
              {player.lastName.toUpperCase()}
            </div>
            <div className="text-[11.5px] font-semibold tracking-[0.04em] opacity-80 mt-1 uppercase">
              {player.team.code} · {player.team.category}
            </div>
          </div>

          <div className="h-px bg-white/25 mx-2" />

          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-4 px-1">
            {rating.stats.map((s) => (
              <div key={s.key} className="flex items-baseline gap-2">
                <span className="font-mono text-[20px] font-black w-[34px] text-right" style={{ fontFamily: "var(--font-parent-display)" }}>
                  {s.value}
                </span>
                <span className="text-[12px] font-bold tracking-[0.04em] opacity-85">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[11.5px] text-[#8A8D93] px-1 leading-relaxed">
        Note générale et notes par catégorie calculées à partir de la dernière évaluation du coach (technique, tactique, physique, comportement).
      </div>
    </div>
  );
}
