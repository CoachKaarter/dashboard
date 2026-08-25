import { Skeleton } from "@/components/ui/Skeleton";
import { MobileTabs, MobileCardList } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
      </div>
      <MobileTabs count={3} />
      <MobileCardList count={5} rowsPerCard={2} />
    </div>
  );
}
