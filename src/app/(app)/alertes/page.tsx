import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAlertGroups } from "@/lib/alerts";
import { FilterChip } from "@/components/ui/FilterChip";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { toQueryString } from "@/lib/query";
import { formatDateShort } from "@/lib/format";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { decideAlert, reopenAlert } from "./actions";

const LEVELS = ["Tous", "Urgent", "À traiter", "À surveiller", "Information"];
const LEVEL_TONE: Record<string, { fg: string; bg: string }> = {
  Urgent: { fg: "#C4362C", bg: "#FBEDEB" },
  "À traiter": { fg: "#C97A17", bg: "#FDF3E4" },
  "À surveiller": { fg: "#3F8F5B", bg: "#ECF5EF" },
  Information: { fg: "#3C6E9F", bg: "#EDF2F8" },
};
const STATUS_LABEL: Record<string, string> = {
  TRAITE: "Traité",
  ASSUME: "Choix assumé",
  IGNORE: "Ignoré",
  REVOIR: "À revoir",
};

export default async function AlertesPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const sp = await searchParams;
  const level = LEVELS.includes(sp.level ?? "") ? sp.level! : "Tous";

  const user = await requireUser();
  const [groups, staff] = await Promise.all([
    getAlertGroups(scopedTeamIds(user)),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
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

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-[104px_74px_minmax(240px,1fr)_96px_132px_150px] gap-3 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
          <div>Niveau</div>
          <div>Concerné</div>
          <div>Message</div>
          <div>Depuis</div>
          <div>Action</div>
          <div>Décision</div>
        </div>
        {rows.map((a) => {
          const tone = LEVEL_TONE[a.level];
          return (
            <div key={a.key} className="border-b border-line-soft-2 last:border-b-0" style={{ opacity: a.treated ? 0.55 : 1 }}>
              <div className="grid grid-cols-[104px_74px_minmax(240px,1fr)_96px_132px_150px] gap-3 items-center px-3.5 py-[11px]">
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
                  {a.decision ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={a.treated ? "green" : "orange"}>{STATUS_LABEL[a.decision.status] ?? a.decision.status}</Badge>
                      {a.decision.assignedToName && <span className="text-[10.5px] text-muted">→ {a.decision.assignedToName}</span>}
                      <form action={reopenAlert.bind(null, a.key)}>
                        <button type="submit" className="text-[10.5px] text-muted-2 hover:text-red underline">
                          rouvrir
                        </button>
                      </form>
                    </div>
                  ) : (
                    <details className="relative">
                      <summary className="cursor-pointer h-[26px] px-2.5 inline-flex items-center rounded-md text-[11.5px] font-semibold border border-line text-muted hover:border-ink hover:text-ink select-none">
                        Décider…
                      </summary>
                      <div className="absolute right-0 z-10 mt-1.5 w-[280px] bg-surface border border-line rounded-lg shadow-lg p-3 flex flex-col gap-2">
                        <form action={decideAlert.bind(null, a.key)} className="flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            {(["TRAITE", "ASSUME", "REVOIR", "IGNORE"] as const).map((s) => (
                              <label key={s} className="flex items-center gap-1.5 text-[11.5px]">
                                <input type="radio" name="status" value={s} defaultChecked={s === "TRAITE"} />
                                {STATUS_LABEL[s]}
                              </label>
                            ))}
                          </div>
                          <input
                            type="date"
                            name="snoozeUntil"
                            className="h-8 border border-line rounded-md px-2 text-[11.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                            title="Date, uniquement pour « Ignoré »"
                          />
                          <select
                            name="assignedToId"
                            defaultValue=""
                            className="h-8 border border-line rounded-md px-2 text-[11.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                          >
                            <option value="">Non assigné</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <textarea
                            name="comment"
                            placeholder="Commentaire (optionnel)"
                            rows={2}
                            className="border border-line rounded-md px-2 py-1.5 text-[11.5px] bg-surface outline-none resize-y focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                          />
                          <button type="submit" className="h-8 rounded-md bg-ink text-white text-[11.5px] font-semibold hover:bg-[#2A2E36]">
                            Enregistrer
                          </button>
                        </form>
                      </div>
                    </details>
                  )}
                </div>
              </div>
              {a.decision?.comment && (
                <div className="px-3.5 pb-2.5 -mt-1.5 text-[11.5px] text-ink-soft">
                  <span className="text-muted-2">Note :</span> {a.decision.comment}
                  {a.decision.snoozeUntil && (
                    <span className="text-muted-2"> · jusqu&apos;au {formatDateShort(a.decision.snoozeUntil)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucune alerte pour ce filtre.</div>}
      </div>
    </div>
  );
}
