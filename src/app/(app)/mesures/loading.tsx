import { Page, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1560px">
      <Chips count={3} />
      <Table rows={8} />
    </Page>
  );
}
