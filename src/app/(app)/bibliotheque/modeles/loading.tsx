import { Page, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="900px">
      <Chips count={2} />
      <Table rows={6} />
    </Page>
  );
}
