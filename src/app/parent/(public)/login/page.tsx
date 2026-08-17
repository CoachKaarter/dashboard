import { parentLoginAction } from "./actions";

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-[#F6F6F3] flex items-center justify-center px-5">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-green" />
          <div className="font-bold text-[15px] tracking-[-0.01em]">Espace Parents</div>
        </div>

        <form action={parentLoginAction} className="bg-white rounded-2xl shadow-sm border border-[#E7E7E2] p-6">
          <div className="text-lg font-bold tracking-[-0.01em]">Connexion</div>
          <div className="text-[#8A8D93] mt-1 text-[13px]">Saint-Sébastien FC — U12/U13</div>

          {error && (
            <div className="mt-4 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">
              Identifiant ou mot de passe incorrect.
            </div>
          )}

          <div className="flex flex-col gap-3.5 mt-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Identifiant</span>
              <input
                name="username"
                autoComplete="username"
                required
                className="h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Mot de passe</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="h-12 border border-[#E7E7E2] rounded-xl px-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <button
              type="submit"
              className="h-12 border-none rounded-xl bg-ink text-white text-[15px] font-semibold cursor-pointer mt-1.5 active:opacity-80"
            >
              Se connecter
            </button>
          </div>
        </form>
        <div className="text-[12.5px] text-[#8A8D93] text-center mt-4">
          Identifiants oubliés ? Contacte le staff de la catégorie.
        </div>
      </div>
    </div>
  );
}
