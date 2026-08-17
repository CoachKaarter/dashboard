import { OBJECTIVE_CATEGORY_LABELS, OBJECTIVE_STATUS_LABELS } from "@/lib/constants";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  A_TRAVAILLER: { bg: "#FDF3E4", fg: "#C97A17" },
  EN_PROGRESSION: { bg: "#EDF2F8", fg: "#3C6E9F" },
  ACQUIS: { bg: "#ECF5EF", fg: "#3F8F5B" },
  ABANDONNE: { bg: "#F1F1EE", fg: "#9A9DA3" },
};

export function ObjectiveCard({
  title,
  category,
  status,
  targetDate,
}: {
  title: string;
  category: string;
  status: string;
  targetDate: Date | null;
}) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.A_TRAVAILLER;
  return (
    <div className="px-4 py-3.5 border-t border-[#EFEFEC] first:border-t-0">
      <div className="flex items-start gap-2.5">
        <span className="text-[18px] leading-none mt-0.5" aria-hidden>
          🎯
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-bold">{title}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">
              {OBJECTIVE_CATEGORY_LABELS[category] ?? category}
            </span>
            <span
              className="inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: style.bg, color: style.fg }}
            >
              {OBJECTIVE_STATUS_LABELS[status] ?? status}
            </span>
          </div>
          {targetDate && (
            <div className="text-[12px] text-[#8A8D93] mt-1.5">
              Échéance {targetDate.getDate()} {MONTHS[targetDate.getMonth()]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
