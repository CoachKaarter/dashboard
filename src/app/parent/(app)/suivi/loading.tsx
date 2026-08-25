import { MobileTitle, MobileCard, MobileCardList } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <MobileTitle />
      <MobileCard rows={2} />
      <MobileCardList count={3} rowsPerCard={2} />
    </div>
  );
}
