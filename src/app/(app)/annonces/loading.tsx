import { Skeleton } from "@/components/ui/Skeleton";
import { Page, CardList } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="900px" flex>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <CardList rows={5} />
    </Page>
  );
}
