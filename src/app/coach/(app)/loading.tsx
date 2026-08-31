import { MobileTitle, MobileCard, MobileCardList } from "@/components/loading/shapes";

// Coach home ((coach)/page.tsx lives directly in this folder) — greeting +
// next session/match highlight card + a short list below.
export default function CoachLoading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein pb-6">
      <MobileTitle />
      <MobileCard rows={3} />
      <MobileCardList count={2} rowsPerCard={2} />
    </div>
  );
}
