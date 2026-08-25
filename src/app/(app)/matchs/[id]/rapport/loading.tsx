import { Page, Header, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="900px">
      <Header />
      <Table rows={6} />
    </Page>
  );
}
