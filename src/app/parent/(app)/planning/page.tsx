import { requireParentReady } from "@/lib/parent-guard";

export default async function ParentPlanningPage() {
  await requireParentReady();
  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-bold tracking-[-0.01em]">Planning</div>
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 text-[13px] text-[#8A8D93]">
        Le planning du mois arrive ici.
      </div>
    </div>
  );
}
