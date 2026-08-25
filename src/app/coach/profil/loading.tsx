import { MobileTitle, MobileCard } from "@/components/loading/shapes";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <MobileTitle />
      <MobileCard rows={4} />
      <MobileCard rows={2} />
    </div>
  );
}
