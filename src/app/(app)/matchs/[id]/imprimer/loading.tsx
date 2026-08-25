import { Page, Table } from "@/components/loading/shapes";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <Page maxWidth="760px" flex>
      <Skeleton className="h-5 w-2/3" />
      <Table rows={6} />
    </Page>
  );
}
