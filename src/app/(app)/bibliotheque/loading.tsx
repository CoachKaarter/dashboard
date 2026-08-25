import { Page, Chips, CardGrid } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <Page maxWidth="1400px">
      <Chips count={3} />
      <CardGrid count={9} />
    </Page>
  );
}
