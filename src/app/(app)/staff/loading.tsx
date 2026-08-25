import { Page, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1300px">
      <Chips count={2} />
      <Table rows={8} />
    </Page>
  );
}
