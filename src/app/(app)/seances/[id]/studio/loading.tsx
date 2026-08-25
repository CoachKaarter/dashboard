import { Page, BackLink, TwoCol } from "@/components/loading/shapes";
import { Skeleton } from "@/components/ui/Skeleton";

// Session Studio is a heavier 3-panel editor — approximated here as a
// header line + a wide main area/sidebar split, same as other detail pages.
export default function Loading() {
  return (
    <Page maxWidth="1500px">
      <BackLink />
      <Skeleton className="h-5 w-1/3 mb-3.5" />
      <TwoCol mainRows={8} sidebarRows={3} />
    </Page>
  );
}
