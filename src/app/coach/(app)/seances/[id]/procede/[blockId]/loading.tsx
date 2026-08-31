import { Skeleton } from "@/components/ui/Skeleton";
import { MobileCard } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein pb-6">
      <Skeleton className="h-3 w-16" />
      <MobileCard rows={4} />
    </div>
  );
}
