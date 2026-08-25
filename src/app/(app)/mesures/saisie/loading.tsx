import { Page, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="720px">
      <Chips count={2} trailing={false} />
      <Table rows={6} />
    </Page>
  );
}
