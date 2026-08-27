import { redirect } from "next/navigation";
import { loginAction } from "@/lib/actions/auth";
import { getAuthedUser } from "@/lib/authz";
import { decideLoginPageRedirect } from "@/lib/redirect-policy";
import { getClub } from "@/lib/club";
import { OnzevoMark } from "@/components/OnzevoMark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Deliberately not done in src/proxy.ts: middleware only knows the JWT
  // decodes, never that the account is still active in the DB (that check
  // — and the resulting redirect loop it caused when done at the edge —
  // belongs here, where getAuthedUser() re-reads the User row).
  const [user, club] = await Promise.all([getAuthedUser(), getClub()]);
  const target = decideLoginPageRedirect(!!user);
  if (target) redirect(target);

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1.15fr_1fr] lg:h-screen lg:min-h-0 bg-bg text-ink font-sans">
      <div className="bg-sidebar text-[#EDEDEA] px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-14 flex flex-col justify-between gap-10 lg:gap-0">
        <div className="flex items-center justify-between gap-4">
          <OnzevoMark variant="light" />
          <div className="flex items-center gap-2">
            {club.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/club/logo?v=${club.logoVersion}`} alt="" className="w-5 h-5 rounded-[4px] object-contain shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-[4px] bg-club-primary shrink-0" />
            )}
            <div className="font-bold tracking-[0.1em] text-[11px] uppercase text-muted truncate max-w-[160px]">{club.name}</div>
          </div>
        </div>
        <div>
          <div className="text-[30px] sm:text-[36px] lg:text-[44px] font-bold leading-[1.05] tracking-[-0.02em] max-w-[460px] text-pretty">
            Le cockpit de la catégorie U12 / U13
          </div>
          <div className="mt-4 lg:mt-5 text-muted text-[14px] lg:text-[15px] max-w-[420px] leading-relaxed">
            Six équipes, 48 joueurs, une saison. Ce qui compte remonte tout seul.
          </div>
        </div>
        <div className="flex gap-8 sm:gap-10 font-mono text-[11px] text-muted tracking-[0.06em]">
          <div>SAISON 2026 / 2027</div>
          <div>ACCÈS INTERNE</div>
        </div>
      </div>

      <div className="bg-surface flex-1 flex items-center justify-center px-5 py-10 sm:p-10">
        <form action={loginAction} className="w-full max-w-80">
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
                autoComplete="username"
                className="h-11 border border-line rounded-md px-[11px] text-[13px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Mot de passe</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                className="h-11 border border-line rounded-md px-[11px] text-[13px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <button
              type="submit"
              className="h-11 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36] active:opacity-90"
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
