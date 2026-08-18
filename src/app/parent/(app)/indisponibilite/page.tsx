import { requireParentReady } from "@/lib/parent-guard";
import { declareUnavailabilityByParent } from "./actions";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { SubmitButton } from "@/components/SubmitButton";

const TYPES = ["Blessure", "Maladie", "Absence longue", "Autre"];

const inputClass =
  "h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg w-full";

export default async function IndisponibilitePage() {
  await requireParentReady();

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader
        title="Signaler une indisponibilité"
        subtitle="Utilisez ce formulaire pour une blessure, une maladie ou une absence de plusieurs jours."
        backHref="/parent/profil"
        backLabel="Profil"
      />

      <form action={declareUnavailabilityByParent}>
        <ParentCard className="flex flex-col gap-4">
          <div>
            <div className="text-[11.5px] font-semibold text-[#6E7178] mb-1.5">Type</div>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <label key={t}>
                  <input type="radio" name="type" value={t} required className="peer sr-only" />
                  <div className="h-14 rounded-xl border-2 border-[#E7E7E2] bg-white text-[13.5px] font-semibold flex items-center justify-center text-center px-2 peer-checked:bg-green-bg peer-checked:border-green peer-checked:text-green peer-checked:scale-[1.02] transition-all duration-150">
                    {t}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Date de début</span>
            <input type="date" name="startDate" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Retour estimé (facultatif)</span>
            <input type="date" name="expectedReturn" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Commentaire (facultatif)</span>
            <textarea
              name="description"
              rows={3}
              className="border border-[#E7E7E2] rounded-xl px-3.5 py-3 text-[15px] bg-[#FCFCFB] outline-none resize-y focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
            />
          </label>
          <SubmitButton
            pendingLabel="Envoi…"
            className="h-12 border-none rounded-xl bg-ink text-white text-[15px] font-semibold cursor-pointer mt-1 active:opacity-80"
          >
            Envoyer au staff
          </SubmitButton>
        </ParentCard>
      </form>
    </div>
  );
}
