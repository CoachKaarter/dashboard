import { Page, Chips, Kpis, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1500px">
      <Chips count={4} />
      <Kpis count={4} />
      <Table rows={8} />
    </Page>
  );
}
