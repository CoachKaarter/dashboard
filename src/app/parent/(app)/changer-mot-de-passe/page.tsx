import { requireParent } from "@/lib/parent-session";
import { changeParentPassword } from "./actions";

export default async function ChangerMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const parent = await requireParent();
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      {parent.mustChangePassword && (
        <div className="bg-blue-bg text-blue rounded-xl px-3.5 py-3 text-[13px] font-medium">
          Pour ta première connexion, choisis ton propre mot de passe.
        </div>
      )}
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouveau mot de passe</div>
        {error && (
          <div className="mb-3.5 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">
            {error === "diff" ? "Les deux mots de passe ne correspondent pas." : "Le mot de passe doit faire au moins 6 caractères."}
          </div>
        )}
        <form action={changeParentPassword} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Nouveau mot de passe</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Confirme le mot de passe</span>
            <input
              type="password"
              name="confirm"
              required
              minLength={6}
              className="h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
            />
          </label>
          <button type="submit" className="h-12 border-none rounded-xl bg-ink text-white text-[15px] font-semibold cursor-pointer mt-1.5 active:opacity-80">
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
