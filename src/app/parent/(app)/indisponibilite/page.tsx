import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { declareUnavailabilityByParent } from "./actions";

const inputClass =
  "h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg w-full";

export default async function IndisponibilitePage() {
  await requireParentReady();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/parent/profil" className="text-[#8A8D93] text-[13px]">← Mon enfant</Link>
      <div className="text-xl font-bold tracking-[-0.01em]">Signaler une indisponibilité</div>
      <div className="text-[13px] text-[#6E7178] -mt-2">
        Le staff sera prévenu et validera l&apos;information.
      </div>

      <form action={declareUnavailabilityByParent} className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-[#6E7178]">Type</span>
          <select name="type" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choisir…</option>
            <option value="Blessure">Blessure</option>
            <option value="Maladie">Maladie</option>
            <option value="Absence longue">Absence longue</option>
            <option value="Autre">Autre</option>
          </select>
        </label>
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
          <textarea name="description" rows={3} className="border border-[#E7E7E2] rounded-xl px-3.5 py-3 text-[15px] bg-[#FCFCFB] outline-none resize-y focus:border-blue focus:ring-[3px] focus:ring-blue-bg" />
        </label>
        <button type="submit" className="h-12 border-none rounded-xl bg-ink text-white text-[15px] font-semibold cursor-pointer mt-1 active:opacity-80">
          Envoyer au staff
        </button>
      </form>
    </div>
  );
}
