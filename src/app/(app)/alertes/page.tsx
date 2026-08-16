import Link from "next/link";
import { getAlertGroups } from "@/lib/alerts";
import { FilterChip } from "@/components/ui/FilterChip";
import { TeamChip } from "@/components/ui/TeamChip";
import { toQueryString } from "@/lib/query";
import { toggleTreated } from "./actions";

const LEVELS = ["Tous", "Urgent", "À traiter", "À surveiller", "Information"];
const LEVEL_TONE: Record<string, { fg: string; bg: string }> = {
  Urgent: { fg: "#C4362C", bg: "#FBEDEB" },
  "À traiter": { fg: "#C97A17", bg: "#FDF3E4" },
  "À surveiller": { fg: "#3F8F5B", bg: "#ECF5EF" },
  Information: { fg: "#3C6E9F", bg: "#EDF2F8" },
};

export default async function AlertesPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const sp = await searchParams;
  const level = LEVELS.includes(sp.level ?? "") ? sp.level! : "Tous";

  const groups = await getAlertGroups();
  const rows = groups
    .filter((g) => level === "Tous" || g.title === level)
    .flatMap((g) => g.items.map((a) => ({ ...a, level: g.title })));

  return (
    <div className="max-w-[1500px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {LEVELS.map((l) => (
          <FilterChip key={l} href={toQueryString({ level: l === "Tous" ? undefined : l })} active={level === l}>
            {l}
          </FilterChip>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className="grid grid-cols-[104px_74px_minmax(240px,1fr)_96px_132px_118px] gap-3 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
          <div>Niveau</div>
          <div>Concerné</div>
          <div>Message</div>
          <div>Depuis</div>
          <div>Action</div>
          <div>Suivi</div>
        </div>
        {rows.map((a) => {
          const tone = LEVEL_TONE[a.level];
          return (
            <div
              key={a.key}
              className="grid grid-cols-[104px_74px_minmax(240px,1fr)_96px_132px_118px] gap-3 items-center px-3.5 py-[11px] border-b border-line-soft-2 last:border-b-0"
              style={{ opacity: a.treated ? 0.45 : 1 }}
            >
              <div>
                <span
                  className="inline-flex items-center h-5 px-2 rounded text-[10.5px] font-bold tracking-[0.06em] uppercase"
                  style={{ color: tone.fg, background: tone.bg }}
                >
                  {a.level}
                </span>
              </div>
              <div>
                <TeamChip code={a.tag} />
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold">{a.title}</div>
                <div className="text-xs text-muted mt-0.5">{a.detail}</div>
              </div>
              <div className="font-mono text-[11px] text-muted-2">{a.meta}</div>
              <div>
                <Link
                  href={a.href}
                  className="inline-flex items-center h-7 px-[11px] border border-line bg-surface rounded-md text-xs font-semibold hover:border-ink hover:bg-bg"
                >
                  {a.action}
                </Link>
              </div>
              <div>
                <form action={toggleTreated.bind(null, a.key)}>
                  <button
                    type="submit"
                    className="h-[26px] px-2.5 rounded-md text-[11.5px] font-semibold border cursor-pointer"
                    style={{
                      borderColor: a.treated ? "#3F8F5B" : "#E3E3DE",
                      background: a.treated ? "#ECF5EF" : "#FFFFFF",
                      color: a.treated ? "#3F8F5B" : "#6E7178",
                    }}
                  >
                    {a.treated ? "Traitée" : "Marquer traitée"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucune alerte pour ce filtre.</div>}
      </div>
    </div>
  );
}
