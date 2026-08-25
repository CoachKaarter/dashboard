import { MobileTitle, MobileCard, MobileCardList } from "@/components/loading/shapes";

// Parent home ((app)/page.tsx lives directly in this folder) — status
// banner + task cards (dispos séances/week-end, questionnaires).
export default function ParentLoading() {
  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <MobileTitle />
      <MobileCard rows={2} />
      <MobileCardList count={3} rowsPerCard={3} />
    </div>
  );
}
