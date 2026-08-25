import { Skeleton } from "@/components/ui/Skeleton";
import { MobileTitle } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <MobileTitle />
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5 flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl mt-2" />
      </div>
    </div>
  );
}
