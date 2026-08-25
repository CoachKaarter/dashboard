import { Page, BackLink, Header, Tabs, TwoCol } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1500px">
      <BackLink />
      <Header kpis />
      <Tabs count={6} />
      <TwoCol mainRows={7} sidebarRows={2} />
    </Page>
  );
}
