import { Skeleton } from "@/components/ui/Skeleton";
import { Page, Panel } from "@/components/loading/shapes";

// Cockpit home ((app)/page.tsx lives directly in this folder) — greeting +
// KPI row + two stacked-panel columns (Section blocks: alertes, prochaines
// séances/matchs, joueurs indisponibles...).
export default function CockpitLoading() {
  return (
    <Page maxWidth="1560px">
      <div className="flex items-end justify-between gap-5 mb-[18px] flex-wrap">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-80" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[46px] w-[110px]" />
          ))}
        </div>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
        <div className="flex flex-col gap-3.5">
          <Panel rows={4} />
          <Panel rows={3} />
        </div>
        <div className="flex flex-col gap-3.5">
          <Panel rows={3} />
          <Panel rows={3} />
        </div>
      </div>
    </Page>
  );
}
