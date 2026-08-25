import { Page, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1620px">
      <Chips count={6} />
      <Table rows={8} />
    </Page>
  );
}
