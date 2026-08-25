import { Page, BackLink, Header, Tabs, TwoCol } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1200px">
      <BackLink />
      <Header kpis />
      <Tabs count={3} />
      <TwoCol mainRows={6} sidebarRows={2} />
    </Page>
  );
}
