import { Skeleton } from "@/components/ui/Skeleton";

// Same Suspense-fallback role as (app)/loading.tsx — CoachBottomNav stays
// mounted, this only fills the scrollable content area above it.
export default function CoachLoading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein pb-6">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex flex-col gap-2.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}
