import { Page, BackLink, Header, Chips, Table } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1100px">
      <BackLink />
      <Header kpis />
      <Chips count={4} trailing={false} />
      <Table rows={8} />
    </Page>
  );
}
