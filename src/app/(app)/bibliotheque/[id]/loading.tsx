import { Skeleton } from "@/components/ui/Skeleton";
import { Page, BackLink } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="820px">
      <BackLink />
      <div className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-2.5">
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-24 w-full mt-2" />
      </div>
    </Page>
  );
}
