import { Page, BackLink, Header, Tabs, TwoCol } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1400px">
      <BackLink />
      <Header avatar kpis />
      <Tabs count={5} />
      <TwoCol mainRows={6} sidebarRows={2} />
    </Page>
  );
}
