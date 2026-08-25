import { Skeleton } from "@/components/ui/Skeleton";
import { MobileCard, MobileTabs, MobileCardList } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein pb-6">
      <Skeleton className="h-3 w-16" />
      <MobileCard rows={3} />
      <MobileTabs count={3} />
      <MobileCardList count={4} rowsPerCard={1} />
    </div>
  );
}
