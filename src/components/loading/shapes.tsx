import { Skeleton } from "@/components/ui/Skeleton";

// Small composable pieces every page-specific loading.tsx builds from —
// keeps each route's loading.tsx a short, readable approximation of its
// real layout instead of 60 lines of raw <Skeleton> divs repeated
// everywhere. Approximate on purpose: a loading state only needs to
// communicate "the real thing has roughly this shape", not pixel-match it.

export function Page({ maxWidth, children, flex = false }: { maxWidth: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div className={`mx-auto animate-fadein ${flex ? "flex flex-col gap-3.5" : ""}`} style={{ maxWidth }}>
      {children}
    </div>
  );
}

export function BackLink() {
  return <Skeleton className="h-3 w-24 mb-2.5" />;
}

export function Chips({ count = 3, trailing = true }: { count?: number; trailing?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20" />
      ))}
      {trailing && (
        <>
          <span className="flex-1" />
          <Skeleton className="h-8 w-32" />
        </>
      )}
    </div>
  );
}

export function Kpis({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-2 mb-3.5 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[46px] w-[130px]" />
      ))}
    </div>
  );
}

export function Table({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="px-3.5 h-[34px] flex items-center border-b border-line-soft">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-3.5 h-[42px] flex items-center gap-3 border-b border-line-soft-2 last:border-b-0">
          <Skeleton className="h-3 w-3 rounded-full shrink-0" />
          <Skeleton className="h-3 flex-1 max-w-[220px]" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function CardList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-surface border border-line rounded-lg px-3.5 py-3 flex flex-col gap-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function CardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Header({ avatar = false, kpis = false }: { avatar?: boolean; kpis?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-5 py-[18px] flex items-center gap-[18px] flex-wrap mb-3.5">
      {avatar && <Skeleton className="h-[54px] w-[54px] rounded-full shrink-0" />}
      <div className="flex-1 min-w-[200px] flex flex-col gap-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {kpis && (
        <div className="flex gap-[22px] flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 items-end">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tabs({ count = 4 }: { count?: number }) {
  return (
    <div className="flex items-center gap-4 mb-3.5 border-b border-line-soft pb-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-16" />
      ))}
    </div>
  );
}

export function Fields({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full mt-1" />
    </div>
  );
}

export function Panel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <Skeleton className="h-3 w-40 mb-3" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full max-w-[420px]" />
        ))}
      </div>
    </div>
  );
}

export function Form({ maxWidth, fields = 5, titleWidth = "w-1/2" }: { maxWidth: string; fields?: number; titleWidth?: string }) {
  return (
    <Page maxWidth={maxWidth}>
      <BackLink />
      <div className="bg-surface border border-line rounded-lg p-5">
        <Skeleton className={`h-5 mb-4 ${titleWidth}`} />
        <Fields count={fields} />
      </div>
    </Page>
  );
}

export function Panels({ maxWidth, count = 3, rows = 3 }: { maxWidth: string; count?: number; rows?: number }) {
  return (
    <Page maxWidth={maxWidth} flex>
      {Array.from({ length: count }).map((_, i) => (
        <Panel key={i} rows={rows} />
      ))}
    </Page>
  );
}

// Mobile variants (Coach/Parent) — same idea, but on the rounded-2xl white
// card + #E7E7E2 border rhythm those two shells use instead of the desktop
// bg-surface/border-line tokens.

export function MobileTitle() {
  return <Skeleton className="h-5 w-40 mb-1" />;
}

export function MobileCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-3 w-20" : "h-4 w-3/5"} />
      ))}
    </div>
  );
}

export function MobileCardList({ count = 4, rowsPerCard = 2 }: { count?: number; rowsPerCard?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <MobileCard key={i} rows={rowsPerCard} />
      ))}
    </div>
  );
}

export function MobileTabs({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 flex-1 rounded-xl" />
      ))}
    </div>
  );
}

export function TwoCol({ sidebarRows = 2, mainRows = 6 }: { sidebarRows?: number; mainRows?: number }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
      <Table rows={mainRows} />
      <CardList rows={sidebarRows} />
    </div>
  );
}
