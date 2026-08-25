import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-full bg-[#F7F7F4] flex justify-center px-4 py-8">
      <div className="w-full max-w-[560px]">
        <div className="bg-white border border-[#E3E3DE] rounded-lg px-5 py-4 mb-3.5 flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-9 w-40 mt-2" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full mb-2" />
        ))}
      </div>
    </div>
  );
}
