import { Page, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1620px">
      <Chips count={4} />
      <Table rows={10} />
    </Page>
  );
}
