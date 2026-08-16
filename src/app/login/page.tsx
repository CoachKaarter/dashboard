import { loginAction } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="grid grid-cols-[1.15fr_1fr] h-screen bg-bg text-ink font-sans">
      <div className="bg-sidebar text-[#EDEDEA] px-16 py-14 flex flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[5px] bg-green" />
          <div className="font-bold tracking-[0.14em] text-xs uppercase">Saint-Sébastien FC</div>
        </div>
        <div>
          <div className="text-[44px] font-bold leading-[1.05] tracking-[-0.02em] max-w-[460px] text-pretty">
            Le cockpit de la catégorie U12 / U13
          </div>
          <div className="mt-5 text-muted text-[15px] max-w-[420px] leading-relaxed">
            Six équipes, 48 joueurs, une saison. Ce qui compte remonte tout seul.
          </div>
        </div>
        <div className="flex gap-10 font-mono text-[11px] text-muted tracking-[0.06em]">
          <div>SAISON 2026 / 2027</div>
          <div>ACCÈS INTERNE</div>
        </div>
      </div>

      <div className="bg-surface flex items-center justify-center p-10">
        <form action={loginAction} className="w-80">
          <div className="text-xl font-semibold tracking-[-0.01em]">Connexion</div>
          <div className="text-muted mt-1.5 text-[13px]">Espace réservé au staff de la catégorie.</div>

          {error && (
            <div className="mt-4 rounded-md border border-red/30 bg-red-bg px-3 py-2 text-[12.5px] text-red">
              Identifiant ou mot de passe incorrect.
            </div>
          )}

          <div className="flex flex-col gap-3.5 mt-7">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Identifiant</span>
              <input
                name="username"
                defaultValue="marvyn"
                className="h-[38px] border border-line rounded-md px-[11px] text-[13px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Mot de passe</span>
              <input
                type="password"
                name="password"
                defaultValue="motdepasse"
                className="h-[38px] border border-line rounded-md px-[11px] text-[13px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <button
              type="submit"
              className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
            >
              Entrer dans le cockpit
            </button>
            <div className="text-xs text-muted-2 text-center mt-0.5">Accès oublié : contacter Marvyn.</div>
          </div>
        </form>
      </div>
    </div>
  );
}
