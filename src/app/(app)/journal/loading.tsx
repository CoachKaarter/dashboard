import { Skeleton } from "@/components/ui/Skeleton";
import { Page, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1000px">
      <Skeleton className="h-5 w-56 mb-1" />
      <Skeleton className="h-3 w-96 mb-3.5" />
      <Table rows={12} />
    </Page>
  );
}
