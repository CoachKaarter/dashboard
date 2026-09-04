import { redirect } from "next/navigation";
import { requireParent } from "@/lib/parent-session";
import { prisma } from "@/lib/prisma";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { SubmitButton } from "@/components/SubmitButton";
import { submitParentOnboardingInfo } from "./actions";

const inputClass =
  "h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg w-full";

// Étape obligatoire juste après l'activation (voir requireParentReady) —
// jamais gardée par requireParentReady() elle-même, ou cette page se
// redirigerait vers elle-même. Une fois onboardingCompletedAt posé, cette
// page n'est plus jamais montrée automatiquement.
export default async function ParentInformationsPage() {
  const parent = await requireParent();
  if (parent.onboardingCompletedAt) redirect("/parent");

  // Un enfant déjà couvert par une soumission PENDING ou VALIDATED n'a pas
  // à être re-saisi ici (évite de redemander les infos d'un aîné déjà
  // traité quand un cadet vient tout juste de rejoindre le même compte).
  const existingSubmissions = await prisma.playerFamilyInfoSubmission.findMany({
    where: { playerId: { in: parent.children.map((c) => c.id) }, status: { in: ["PENDING", "VALIDATED"] } },
    select: { playerId: true },
  });
  const alreadySubmitted = new Set(existingSubmissions.map((s) => s.playerId));
  const childrenToFill = parent.children.filter((c) => !alreadySubmitted.has(c.id));

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Vos informations" subtitle="Une dernière étape avant de découvrir votre espace famille." />

      <form action={submitParentOnboardingInfo} className="flex flex-col gap-4">
        <ParentCard className="flex flex-col gap-4">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">Vos coordonnées</div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Prénom</span>
            <input name="parentFirstName" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Nom</span>
            <input name="parentLastName" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Téléphone</span>
            <input type="tel" name="parentPhone" required className={inputClass} />
          </label>
        </ParentCard>

        {childrenToFill.map((child) => (
          <ParentCard key={child.id} className="flex flex-col gap-4">
            <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">Informations de {child.firstName}</div>
            <input type="hidden" name="childIds" value={child.id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Prénom</span>
              <input name={`child_${child.id}_firstName`} required defaultValue={child.firstName} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Nom</span>
              <input name={`child_${child.id}_lastName`} required defaultValue={child.lastName} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Date de naissance</span>
              <input type="date" name={`child_${child.id}_birthDate`} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Numéro de licence</span>
              <input name={`child_${child.id}_licenseNumber`} required className={inputClass} />
            </label>
          </ParentCard>
        ))}

        {childrenToFill.length > 0 && (
          <p className="text-[11.5px] text-[#9A9DA3] -mt-1.5">
            Ces informations sont transmises au club, qui les vérifie avant de les appliquer à la fiche officielle.
          </p>
        )}

        <SubmitButton
          pendingLabel="Envoi…"
          className="h-12 border-none rounded-xl text-white text-[15px] font-bold cursor-pointer bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
        >
          Continuer
        </SubmitButton>
      </form>
    </div>
  );
}
