import { Page, Kpis, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1000px">
      <Kpis count={4} />
      <Table rows={6} />
    </Page>
  );
}
