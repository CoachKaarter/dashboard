import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireParentReady } from "@/lib/parent-guard";
import { matchTypeBadge } from "@/lib/match-phase";
import { TRANSPORT_MODE_LABELS } from "@/lib/equipment";
import { formatDateFull } from "@/lib/format";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { CopyButton } from "@/components/CopyButton";
import { CheckIcon, XIcon } from "@/components/parent/icons";
import { confirmMyConvocation } from "../../planning/actions";

/**
 * Fiche complète de convocation (Cockpit v1.1 §3) — n'existe que pour UNE
 * convocation officiellement publiée pour CE joueur : la requête ci-dessous
 * filtre par (matchId, playerId) exactement comme partout ailleurs dans
 * l'espace parent (jamais par Match.teamId / Player.teamId). Sans ligne
 * MatchConvocation pour ce joueur, 404 — jamais une fiche "vide" qui
 * laisserait deviner qu'un match existe.
 */
export default async function ParentMatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const parent = await requireParentReady();
  const { matchId } = await params;

  const convocation = await prisma.matchConvocation.findUnique({
    where: { matchId_playerId: { matchId, playerId: parent.playerId } },
    include: { match: { include: { team: true } } },
  });
  if (!convocation) notFound();
  const { match } = convocation;

  const statusLabel =
    convocation.confirmed === true ? "Convoqué — présence confirmée" : convocation.confirmed === false ? "Convoqué — forfait déclaré" : "Convoqué — en attente de votre réponse";

  const address = match.venueAddress ?? match.location;
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title={matchTypeBadge(match.competition)} subtitle={formatDateFull(match.date)} backHref="/parent/matchs" backLabel="Rencontres à venir" />

      <ParentCard>
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">Informations principales</div>
        <div className="text-[18px] font-bold mt-1" style={{ fontFamily: "var(--font-parent-display)" }}>
          {match.team.code} — {match.opponent ?? "Adversaire à définir"}
        </div>
        <div className="text-[13px] text-[#6E7178] mt-0.5">{statusLabel}</div>

        <div className="mt-3 pt-3 border-t border-[#EFEFEC] flex flex-col gap-1.5">
          <Row label="Rendez-vous" value={match.meetTime} />
          <Row label="Coup d'envoi" value={match.time} />
          <Row label="Fin" value={match.estimatedEndTime} estimated />
          <Row label="Retour" value={match.estimatedReturnTime} estimated />
        </div>

        <div className="flex gap-1.5 mt-3.5">
          <form action={confirmMyConvocation.bind(null, matchId, true)} className="flex-1">
            <button
              type="submit"
              className={`w-full h-11 rounded-xl text-[13px] font-bold border-2 inline-flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150 ${
                convocation.confirmed === true ? "bg-green border-green text-white" : "bg-white border-[#E7E7E2] text-green"
              }`}
            >
              <CheckIcon size={15} /> Je viens
            </button>
          </form>
          <form action={confirmMyConvocation.bind(null, matchId, false)} className="flex-1">
            <button
              type="submit"
              className={`w-full h-11 rounded-xl text-[13px] font-bold border-2 inline-flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150 ${
                convocation.confirmed === false ? "bg-red border-red text-white" : "bg-white border-[#E7E7E2] text-red"
              }`}
            >
              <XIcon size={15} /> Absent
            </button>
          </form>
        </div>
      </ParentCard>

      {(match.location || address) && (
        <ParentCard>
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">Localisation</div>
          {match.location && <div className="text-[15px] font-bold mt-1">{match.location}</div>}
          {address && <div className="text-[13px] text-[#6E7178] mt-0.5">{address}</div>}
          <div className="flex gap-1.5 mt-3">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-10 rounded-xl bg-parent-navy text-white text-[13px] font-bold inline-flex items-center justify-center"
              >
                Ouvrir dans Maps
              </a>
            )}
            {address && (
              <CopyButton
                text={address}
                label="Copier l'adresse"
                className="flex-1 h-10 rounded-xl border border-[#DADCE3] text-parent-navy text-[13px] font-bold inline-flex items-center justify-center"
              />
            )}
          </div>
        </ParentCard>
      )}

      {(match.transportMode || match.dressCode || match.personalGear || match.mealInfo || match.parentInstructions || match.parentNotes) && (
        <ParentCard>
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">Organisation</div>
          <div className="mt-2 flex flex-col gap-2.5">
            <Row label="Transport" value={match.transportMode ? TRANSPORT_MODE_LABELS[match.transportMode] : null} />
            <Row label="Tenue demandée" value={match.dressCode} />
            <Row label="Matériel personnel" value={match.personalGear} />
            <Row label="Repas / collation" value={match.mealInfo} />
            <Row label="Consignes du staff" value={match.parentInstructions} />
            <Row label="Informations complémentaires" value={match.parentNotes} />
          </div>
        </ParentCard>
      )}
    </div>
  );
}

function Row({ label, value, estimated }: { label: string; value: string | null; estimated?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
      <span className="text-[#8A8D93]">{label}</span>
      <span className="font-semibold text-right">
        {value}
        {estimated && <span className="text-[11px] font-normal text-[#B08A3E] italic ml-1">(estimée)</span>}
      </span>
    </div>
  );
}
