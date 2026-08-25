import { Skeleton } from "@/components/ui/Skeleton";
import { Page, Kpis } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1400px">
      <div className="bg-surface border border-line rounded-lg px-4 py-3.5 flex items-center gap-3 flex-wrap mb-3.5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <span className="flex-1" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Kpis count={8} />
      <div className="grid grid-cols-3 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-line-soft flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="p-3.5 flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
