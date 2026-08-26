import Link from "next/link";
import { ParentCard } from "./ParentCard";
import { ChevronRightIcon, TargetIcon, FlagIcon } from "./icons";
import { OBJECTIVE_CATEGORY_LABELS, OBJECTIVE_STATUS_LABELS } from "@/lib/constants";

/**
 * "SUIVI DE MON ENFANT" — uniquement l'objectif courant et le dernier
 * retour publié (spec) : jamais les notes internes du coach ni le détail
 * des entretiens. Pas d'emoji (règle répétée du spec pour tout l'espace
 * parent) — l'ancienne page Suivi utilise encore des émojis pour les
 * ressentis (§ hors périmètre de cette refonte, non touché ici).
 */
export function SuiviSection({
  firstName,
  objective,
  feedback,
}: {
  firstName: string;
  objective: { id: string; title: string; category: string; status: string } | null;
  feedback: { id: string; comment: string } | null;
}) {
  if (!objective && !feedback) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between mt-1">
        <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3]">Suivi de {firstName}</div>
        <Link href="/parent/suivi" className="flex items-center gap-0.5 text-[12.5px] font-bold text-green">
          Tout voir <ChevronRightIcon size={14} />
        </Link>
      </div>
      {objective && (
        <ParentCard className="flex items-start gap-2.5">
          <span className="text-[#9A9DA3] mt-0.5 shrink-0" aria-hidden>
            <TargetIcon size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">
              {OBJECTIVE_CATEGORY_LABELS[objective.category] ?? objective.category}
            </div>
            <div className="text-[14.5px] font-bold mt-0.5">{objective.title}</div>
            <div className="text-[12px] text-[#6E7178] mt-1">{OBJECTIVE_STATUS_LABELS[objective.status] ?? objective.status}</div>
          </div>
        </ParentCard>
      )}
      {feedback && (
        <ParentCard className="flex items-start gap-2.5">
          <span className="text-[#9A9DA3] mt-0.5 shrink-0" aria-hidden>
            <FlagIcon size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">Retour du staff</div>
            <div className="text-[13.5px] mt-0.5">{feedback.comment}</div>
          </div>
        </ParentCard>
      )}
    </div>
  );
}
