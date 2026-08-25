import { requireUser } from "@/lib/authz";
import { Badge } from "@/components/ui/Badge";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const user = await requireUser({ skipOnboardingCheck: true });
  const scopes = [...user.scopes].sort((a, b) => {
    if (a.level !== b.level) return a.level === "RESPONSABLE" ? -1 : 1;
    const aLabel = a.kind === "team" ? a.teamCode : a.category;
    const bLabel = b.kind === "team" ? b.teamCode : b.category;
    return aLabel.localeCompare(bLabel);
  });

  return (
    <div className="max-w-[560px] mx-auto animate-fadein mt-10">
      <div className="bg-surface border border-line rounded-lg p-6">
        <div className="text-xl font-bold tracking-[-0.01em]">Bienvenue, {user.name.split(" ")[0]}</div>
        <div className="text-muted mt-1.5 text-[13px]">
          Voici votre périmètre sur l&apos;application — les catégories et équipes que vous allez gérer.
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          {scopes.map((s) => {
            const label = s.kind === "team" ? s.teamCode : s.category;
            const detail = s.kind === "team" ? `Équipe · ${s.category}` : "Catégorie entière";
            return (
              <div key={`${s.kind}-${label}`} className="flex items-center gap-2.5 border border-line rounded-md px-3 h-11">
                <Badge tone={s.level === "RESPONSABLE" ? "blue" : "neutral"}>{s.level === "RESPONSABLE" ? "Responsable" : "Coach"}</Badge>
                <span className="text-[13px] font-semibold">{label}</span>
                <span className="flex-1" />
                <span className="text-[11.5px] text-muted">{detail}</span>
              </div>
            );
          })}
          {scopes.length === 0 && (
            <div className="text-[12.5px] text-muted-2 py-2">
              Aucune responsabilité ne vous a encore été attribuée. Contactez un administrateur du club.
            </div>
          )}
        </div>

        <form action={completeOnboarding} className="mt-6">
          <button
            type="submit"
            className="h-10 w-full border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer hover:bg-[#2A2E36]"
          >
            C&apos;est parti
          </button>
        </form>
      </div>
    </div>
  );
}
