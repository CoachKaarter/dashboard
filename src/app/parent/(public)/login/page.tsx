import { parentLoginAction } from "./actions";
import { PasswordField } from "@/components/parent/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { OnzevoMark } from "@/components/OnzevoMark";
import { CalendarIcon, ClipboardIcon, UsersIcon, BellIcon, ShieldCheckIcon, UserIcon, LockIcon } from "@/components/parent/icons";

const FEATURES = [
  { icon: CalendarIcon, title: "Planning de la semaine", desc: "Consultez les entraînements et matchs à venir." },
  { icon: ClipboardIcon, title: "Convocations", desc: "Soyez informé des convocations de votre enfant." },
  { icon: UsersIcon, title: "Présences", desc: "Suivez les présences et les absences." },
  { icon: BellIcon, title: "Infos du club", desc: "Actualités, annonces et informations importantes." },
] as const;

/**
 * Refonte visuelle de la connexion parent (maquette fournie par l'utilisateur) —
 * deux écarts assumés par rapport à la maquette, pour rester honnête avec ce
 * qui existe réellement dans l'app :
 *  - Champ "Identifiant" (pas "Adresse e-mail") : ParentAccount n'a pas de
 *    champ email, seulement un username choisi par le staff à la création
 *    du compte famille.
 *  - Un seul bloc "contacter le staff" sous le bouton, pas trois liens
 *    ("Première connexion", "Mot de passe oublié", "Aide/contact") : aucune
 *    de ces trois pages/flux n'existe (pas d'envoi d'email dans l'app), donc
 *    pas de lien mort — la vraie voie de récupération reste le staff.
 */
export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1.2fr_1fr] lg:h-screen lg:min-h-0" style={{ fontFamily: "var(--font-parent-body)" }}>
      <div
        className="relative overflow-hidden text-white px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14 flex flex-col justify-between gap-10 lg:gap-8"
        style={{ background: "linear-gradient(165deg, #0c1129 0%, var(--color-parent-navy) 45%, #0e2e21 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute -top-24 left-[4%] w-96 h-96 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.11), transparent 70%)", filter: "blur(30px)" }}
          />
          <div
            className="absolute -top-16 right-[10%] w-96 h-96 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(0,230,138,0.13), transparent 70%)", filter: "blur(30px)" }}
          />
          <svg className="absolute left-0 right-0 bottom-0 w-full h-[22%]" viewBox="0 0 800 160" preserveAspectRatio="none">
            <defs>
              <radialGradient id="pitch-glow" cx="50%" cy="100%" r="100%">
                <stop offset="0%" stopColor="#123324" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0c1129" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="160" fill="url(#pitch-glow)" />
            <line x1="0" y1="18" x2="800" y2="18" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            <circle cx="400" cy="18" r="50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative z-10">
          <OnzevoMark variant="light" />
        </div>

        <div className="relative z-10">
          <h1
            className="text-[30px] sm:text-[38px] lg:text-[44px] font-bold leading-[1.06] tracking-[-0.02em] max-w-[480px] text-pretty"
            style={{ fontFamily: "var(--font-parent-display)" }}
          >
            <span style={{ color: "#00E68A" }}>L&apos;espace famille</span> du club, en toute simplicité.
          </h1>
          <p className="mt-4 lg:mt-5 text-white/70 text-[14.5px] lg:text-[15.5px] max-w-[440px] leading-relaxed">
            Retrouvez le planning de la semaine, les convocations, les présences et toutes les infos utiles pour suivre
            votre enfant au quotidien.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#00E68A]">
                  <f.icon size={19} />
                </div>
                <div>
                  <div className="font-bold text-[14.5px]">{f.title}</div>
                  <div className="text-white/60 text-[13px] mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-start gap-2.5">
          <ShieldCheckIcon size={18} className="text-[#00E68A] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[13px]">Vos données sont en sécurité</div>
            <div className="text-white/55 text-[12px] mt-0.5">Onzevo protège vos informations personnelles.</div>
          </div>
        </div>
      </div>

      <div className="bg-[#F6F6F4] flex-1 flex items-center justify-center px-5 py-10 sm:p-10">
        <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] border border-[#E7E7E2] p-7">
          <div className="text-[22px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
            Connexion
          </div>
          <div className="text-[13.5px] text-[#6E7178] mt-1">Accédez à votre espace famille.</div>

          <div className="h-px bg-[#EFEFEC] my-5" />

          {error && (
            <div className="mb-4 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">
              Identifiant ou mot de passe incorrect.
            </div>
          )}

          <form action={parentLoginAction} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-[#6E7178]">Identifiant</span>
              <div className="relative">
                <span className="absolute left-3.5 top-0 h-12 flex items-center text-[#9A9DA3] pointer-events-none">
                  <UserIcon size={18} />
                </span>
                <input
                  name="username"
                  autoComplete="username"
                  required
                  placeholder="Votre identifiant"
                  className="h-12 w-full border border-[#E7E7E2] rounded-xl pl-11 pr-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                />
              </div>
            </label>
            <PasswordField name="password" label="Mot de passe" autoComplete="current-password" icon={<LockIcon size={18} />} />
            <SubmitButton
              pendingLabel="Connexion…"
              className="h-12 border-none rounded-xl text-white text-[15px] font-bold cursor-pointer mt-1.5 bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
            >
              Entrer dans l&apos;espace famille
            </SubmitButton>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#EFEFEC]" />
            <span className="text-[11px] text-[#9A9DA3] uppercase tracking-[0.08em]">ou</span>
            <div className="flex-1 h-px bg-[#EFEFEC]" />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#F6F6F4] px-3.5 py-3">
            <UsersIcon size={16} className="text-[#9A9DA3] shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-[#6E7178] leading-snug">
              Identifiants oubliés ou première connexion ? Contacte le staff U12/U13.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
