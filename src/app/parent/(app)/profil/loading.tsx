import { Skeleton } from "@/components/ui/Skeleton";
import { MobileCardList } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5 flex items-center gap-3.5">
        <Skeleton className="h-[52px] w-[52px] rounded-full shrink-0" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <MobileCardList count={4} rowsPerCard={1} />
    </div>
  );
}
