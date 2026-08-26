import Link from "next/link";
import { confirmMyConvocation } from "@/app/parent/(app)/planning/actions";
import { MarkSeenOnMount } from "./MarkSeenOnMount";
import type { PriorityCard, PriorityCta, PriorityLevel } from "@/lib/parent-priority";

/**
 * Accueil Parent v2 — LE Hero unique de "Maintenant" (spec : jamais deux à
 * la fois). Visuel repris de la maquette Claude Design "Espace Parent v2" :
 * un bandeau carmin pleine largeur ("● RÉPONSE ATTENDUE") au-dessus d'une
 * carte blanche pour tout ce qui demande une action (P0/P1), un titre en
 * Barlow Condensed, un bouton principal bleu nuit plein + un secondaire en
 * contour blanc. P2-P4 restent une simple carte blanche sobre — le carmin
 * est réservé à "il faut agir", jamais un habillage par défaut.
 */
const DISPLAY_FONT = { fontFamily: "var(--font-parent-display)" };

const ATTENTION_LEVELS: PriorityLevel[] = ["P0", "P1"];

const QUIET_STYLE: Record<PriorityLevel, { fg: string; fgSoft: string }> = {
  P0: { fg: "text-parent-crimson", fgSoft: "text-[#8A5049]" },
  P1: { fg: "text-parent-crimson", fgSoft: "text-[#8A5049]" },
  P2: { fg: "text-blue", fgSoft: "text-[#5C7B9A]" },
  P3: { fg: "text-green", fgSoft: "text-[#5C8465]" },
  P4: { fg: "text-[#6E7178]", fgSoft: "text-[#8A8D93]" },
};

function eyebrow(card: PriorityCard): string | null {
  if (card.priorityLevel === "P0") return "Important";
  if (card.priorityLevel === "P1") return "Action requise";
  if (card.isNew && card.priorityLevel === "P3") return "Nouveauté";
  return null;
}

export function HeroCard({ card }: { card: PriorityCard }) {
  const attention = ATTENTION_LEVELS.includes(card.priorityLevel);
  const s = QUIET_STYLE[card.priorityLevel];
  const tag = eyebrow(card);
  const anim = card.isNew ? "animate-slidedown" : "animate-fadein";

  return (
    <div className={anim}>
      {card.ref && <MarkSeenOnMount entityType={card.ref.entityType} entityId={card.ref.entityId} />}

      {attention && tag && (
        <div className="bg-parent-crimson text-white rounded-t-[18px] px-5 py-2.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" aria-hidden />
          <span className="text-[11px] font-bold tracking-[0.09em] uppercase">{tag}</span>
        </div>
      )}

      <div className={`bg-white border border-[#E7E7E2] shadow-[0_2px_10px_rgba(23,31,62,0.06)] p-5 ${attention && tag ? "rounded-b-[18px]" : "rounded-[18px]"}`}>
        {!attention && tag && <div className={`text-[11px] font-bold tracking-[0.09em] uppercase ${s.fg}`}>{tag}</div>}
        <div className={`text-[22px] font-bold leading-[1.05] ${!attention && tag ? "mt-1" : ""}`} style={DISPLAY_FONT}>
          {card.title}
        </div>
        {card.description && <div className={`text-[14.5px] mt-2 ${s.fgSoft}`}>{card.description}</div>}
        {card.detail && <div className={`text-[13px] mt-1 ${s.fgSoft}`}>{card.detail}</div>}
        {(card.cta || card.secondaryCta) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {card.cta && <CtaButton cta={card.cta} matchId={card.matchId} primary />}
            {card.secondaryCta && <CtaButton cta={card.secondaryCta} matchId={card.matchId} />}
          </div>
        )}
      </div>
    </div>
  );
}

function CtaButton({ cta, matchId, primary }: { cta: PriorityCta; matchId?: string; primary?: boolean }) {
  const style = primary ? "bg-parent-navy text-white" : "bg-white border border-[#DADCE3] text-parent-navy";
  const className = `h-12 px-4 rounded-xl text-[14px] font-bold inline-flex items-center justify-center active:scale-[0.98] transition-all duration-150 ${style}`;

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
