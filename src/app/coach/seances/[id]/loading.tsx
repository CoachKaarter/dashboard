import { Skeleton } from "@/components/ui/Skeleton";
import { MobileCard, MobileTabs, MobileCardList } from "@/components/loading/shapes";

// Séance detail — Pointage / Séance / Fin tabs.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein pb-6">
      <Skeleton className="h-3 w-16" />
      <MobileCard rows={2} />
      <MobileTabs count={3} />
      <MobileCardList count={6} rowsPerCard={2} />
    </div>
  );
}
