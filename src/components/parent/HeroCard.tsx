import Link from "next/link";
import { confirmMyConvocation } from "@/app/parent/(app)/planning/actions";
import { MarkSeenOnMount } from "./MarkSeenOnMount";
import type { PriorityCard, PriorityCta, PriorityLevel } from "@/lib/parent-priority";

/**
 * Accueil Parent v2 — LE Hero unique de "Maintenant" (spec : jamais deux à
 * la fois). Une seule variante de carte, différenciée par la couleur/le
 * libellé/le CTA — pas douze composants différents. P1 (action requise)
 * reprend l'accent de marque du club (spec : "réutilise --club-primary
 * comme accent du Hero") ; les autres niveaux gardent la palette sobre déjà
 * utilisée ailleurs dans l'espace parent (ParentStatusBanner).
 */
const LEVEL_STYLE: Record<PriorityLevel, { bg: string; border: string; fg: string; fgSoft: string; btn: string }> = {
  P0: { bg: "bg-red-bg", border: "border-[#F0C9C4]", fg: "text-red", fgSoft: "text-[#8A5049]", btn: "bg-red text-white" },
  P1: { bg: "bg-club-primary-bg", border: "border-club-primary/25", fg: "text-club-primary", fgSoft: "text-[#4A5A50]", btn: "bg-club-primary text-club-primary-foreground" },
  P2: { bg: "bg-blue-bg", border: "border-[#CBDCEC]", fg: "text-blue", fgSoft: "text-[#5C7B9A]", btn: "bg-blue text-white" },
  P3: { bg: "bg-green-bg", border: "border-[#CFE6D6]", fg: "text-green", fgSoft: "text-[#5C8465]", btn: "bg-green text-white" },
  P4: { bg: "bg-white", border: "border-[#E7E7E2]", fg: "text-[#6E7178]", fgSoft: "text-[#8A8D93]", btn: "bg-ink text-white" },
};

function eyebrow(card: PriorityCard): string | null {
  if (card.priorityLevel === "P0") return "Important";
  if (card.priorityLevel === "P1") return "Action requise";
  if (card.isNew && card.priorityLevel === "P3") return "Nouveauté";
  return null;
}

export function HeroCard({ card }: { card: PriorityCard }) {
  const s = LEVEL_STYLE[card.priorityLevel];
  const tag = eyebrow(card);

  return (
    <div className={`rounded-2xl border p-5 ${s.bg} ${s.border} ${card.isNew ? "animate-slidedown" : "animate-fadein"}`}>
      {card.ref && <MarkSeenOnMount entityType={card.ref.entityType} entityId={card.ref.entityId} />}
      {tag && <div className={`text-[11px] font-bold tracking-[0.09em] uppercase ${s.fg}`}>{tag}</div>}
      <div className={`text-[20px] font-bold leading-tight ${tag ? "mt-1" : ""}`}>{card.title}</div>
      {card.description && <div className={`text-[14.5px] mt-1.5 ${s.fgSoft}`}>{card.description}</div>}
      {card.detail && <div className={`text-[13px] mt-1 ${s.fgSoft}`}>{card.detail}</div>}
      {(card.cta || card.secondaryCta) && (
        <div className="flex flex-wrap gap-2 mt-4">
          {card.cta && <CtaButton cta={card.cta} matchId={card.matchId} style={s.btn} />}
          {card.secondaryCta && <CtaButton cta={card.secondaryCta} matchId={card.matchId} style={`bg-white border ${s.border} ${s.fg}`} />}
        </div>
      )}
    </div>
  );
}

function CtaButton({ cta, matchId, style }: { cta: PriorityCta; matchId?: string; style: string }) {
  const className = `h-11 px-4 rounded-xl text-[13.5px] font-bold inline-flex items-center justify-center active:scale-[0.98] transition-all duration-150 ${style}`;

  if (cta.href) {
    return (
      <Link href={cta.href} className={className}>
        {cta.label}
      </Link>
    );
  }

  if (cta.action && matchId) {
    const confirmed = cta.action === "CONFIRM_PRESENT";
    return (
      <form action={confirmMyConvocation.bind(null, matchId, confirmed)}>
        <button type="submit" className={className}>
          {cta.label}
        </button>
      </form>
    );
  }

  return null;
}
