import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5 flex flex-col gap-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl mt-1" />
      </div>
    </div>
  );
}
