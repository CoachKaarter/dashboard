import { Skeleton } from "@/components/ui/Skeleton";

// Automatic Suspense fallback (Next.js loading.js convention) shown the
// instant navigation starts within (app), while the target page.tsx's own
// (often several parallel) queries are still in flight. Sidebar/Header stay
// mounted and interactive — this only fills the content area they wrap.
export default function AppLoading() {
  return (
    <div className="max-w-[1400px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <span className="flex-1" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="flex gap-2 mb-3.5 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[46px] w-[130px]" />
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 h-[34px] flex items-center border-b border-line-soft">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-3.5 h-[42px] flex items-center gap-3 border-b border-line-soft-2 last:border-b-0">
            <Skeleton className="h-3 w-3 rounded-full shrink-0" />
            <Skeleton className="h-3 flex-1 max-w-[220px]" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
