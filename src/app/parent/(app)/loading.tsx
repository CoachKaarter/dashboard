import { Skeleton } from "@/components/ui/Skeleton";

// Same Suspense-fallback role as (app)/loading.tsx — ParentTopNav and
// ParentBottomNav stay mounted, this only fills the content area between
// them while the target page's own queries (parent + player + team...) are
// still in flight.
export default function ParentLoading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex flex-col gap-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
