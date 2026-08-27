import { parentLoginAction } from "./actions";
import { PasswordField } from "@/components/parent/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { OnzevoMark } from "@/components/OnzevoMark";

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-[#F6F6F4] flex items-center justify-center px-5">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-green flex items-center justify-center text-white font-bold text-[20px] tracking-[-0.02em]">
            SS
          </div>
          <div className="font-bold text-[17px] tracking-[-0.01em] mt-3.5">Saint-Sébastien FC</div>
          <div className="text-[11.5px] font-bold tracking-[0.1em] uppercase text-[#9A9DA3] mt-0.5">Espace famille</div>
          <div className="text-[13.5px] text-[#6E7178] text-center mt-2.5 leading-snug">
            Votre semaine de football,
            <br />
            simplement.
          </div>
        </div>

        <form action={parentLoginAction} className="bg-white rounded-2xl shadow-sm border border-[#E7E7E2] p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">
              Identifiant ou mot de passe incorrect.
            </div>
          )}

          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Identifiant</span>
              <input
                name="username"
                autoComplete="username"
                required
                className="h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <PasswordField name="password" label="Mot de passe" autoComplete="current-password" />
            <SubmitButton
              pendingLabel="Connexion…"
              className="h-12 border-none rounded-xl bg-ink text-white text-[15px] font-semibold cursor-pointer mt-1.5 active:opacity-80"
            >
              Se connecter
            </SubmitButton>
          </div>
        </form>
        <div className="text-[12.5px] text-[#8A8D93] text-center mt-4">
          Identifiants oubliés ? Contacte le staff U12/U13.
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-7 opacity-60">
          <span className="text-[11px] text-[#8A8D93]">Propulsé par</span>
          <OnzevoMark variant="dark" size="sm" />
        </div>
      </div>
    </div>
  );
}
