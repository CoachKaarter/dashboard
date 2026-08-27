import { MobileTitle, MobileCardList } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <MobileTitle />
      <MobileCardList count={3} rowsPerCard={4} />
    </div>
  );
}
