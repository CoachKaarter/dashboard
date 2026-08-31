import { loginAction } from "@/lib/actions/auth";
import { OnzevoMark } from "@/components/OnzevoMark";
import { PasswordField } from "@/components/parent/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import {
  ClipboardIcon,
  UserCheckIcon,
  FlagIcon,
  ChartIcon,
  UsersIcon,
  CalendarIcon,
  TrophyIcon,
  ShieldCheckIcon,
  UserIcon,
  LockIcon,
} from "@/components/parent/icons";

type Feature = { icon: typeof CalendarIcon; title: string; desc: string };
type Variant = {
  headline: { text: string; accent?: boolean }[];
  subtext: string;
  features: Feature[];
  trustText: string;
  buttonLabel: string;
  cardSubtitle: string;
  identifierPlaceholder: string;
};

// /coach and the Cockpit are two doors onto the same staff account — one
// shared visual (this component, rendered from both src/app/login and
// src/app/coach/(public)/login) rather than two screens that would drift
// out of sync with the actual auth system. Only the entry URL differs:
// /coach/login is the stable, bookmarkable door for coaches (never has to
// pass through the Cockpit first); /login?next=/coach is kept working for
// any old bookmark/link.
const VARIANTS: Record<"coach" | "cockpit", Variant> = {
  coach: {
    headline: [{ text: "L’espace coach", accent: true }, { text: " du club, au bord du terrain." }],
    subtext: "Préparez vos séances, gérez vos matchs, pointez les joueurs et gardez tout le terrain sous contrôle.",
    features: [
      { icon: ClipboardIcon, title: "Séances", desc: "Préparez et retrouvez les contenus du jour." },
      { icon: UserCheckIcon, title: "Pointage terrain", desc: "Présences, retards et suivi rapide des joueurs." },
      { icon: FlagIcon, title: "Matchs", desc: "Convocations, compositions et infos utiles." },
      { icon: ChartIcon, title: "Suivi", desc: "Mesures, évaluations et retours du groupe." },
    ],
    trustText: "Onzevo protège les informations du staff et du club.",
    buttonLabel: "Entrer dans l’espace coach",
    cardSubtitle: "Accédez à votre espace coach.",
    identifierPlaceholder: "Ex. : coach.martin",
  },
  cockpit: {
    headline: [{ text: "Pilotez tout le club, depuis " }, { text: "un seul cockpit.", accent: true }],
    subtext: "Effectifs, planning, matchs, disponibilités, matériel et suivi : toute l’organisation remonte au même endroit.",
    features: [
      { icon: UsersIcon, title: "Organisation", desc: "Effectifs, équipes et planning de la semaine." },
      { icon: CalendarIcon, title: "Week-end", desc: "Répartition, convocations et validation du plan." },
      { icon: TrophyIcon, title: "Matchs", desc: "Résultats, compositions, statistiques et suivi." },
      { icon: ChartIcon, title: "Pilotage", desc: "Alertes, matériel, disponibilité et vision d’ensemble." },
    ],
    trustText: "Onzevo protège les informations du staff, des joueurs et des familles.",
    buttonLabel: "Entrer dans le cockpit",
    cardSubtitle: "Accédez à votre cockpit.",
    identifierPlaceholder: "Ex. : marvyn",
  },
};

export function StaffLoginScreen({ variant, next, error }: { variant: "coach" | "cockpit"; next: string; error?: string }) {
  const v = VARIANTS[variant];

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1.2fr_1fr] lg:h-screen lg:min-h-0 text-ink font-sans">
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
          <h1 className="text-[30px] sm:text-[38px] lg:text-[44px] font-bold leading-[1.06] tracking-[-0.02em] max-w-[480px] text-pretty">
            {v.headline.map((seg, i) => (
              <span key={i} style={seg.accent ? { color: "#00E68A" } : undefined}>
                {seg.text}
              </span>
            ))}
          </h1>
          <p className="mt-4 lg:mt-5 text-white/70 text-[14.5px] lg:text-[15.5px] max-w-[440px] leading-relaxed">{v.subtext}</p>

          <div className="mt-8 flex flex-col gap-4">
            {v.features.map((f) => (
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
            <div className="text-white/55 text-[12px] mt-0.5">{v.trustText}</div>
          </div>
        </div>
      </div>

      <div className="bg-bg flex-1 flex items-center justify-center px-5 py-10 sm:p-10">
        <div className="w-full max-w-[380px] bg-surface rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] border border-line p-7">
          <div className="text-[22px] font-bold tracking-[-0.01em]">Connexion</div>
          <div className="text-[13.5px] text-muted mt-1">{v.cardSubtitle}</div>

          <div className="h-px bg-line-soft my-5" />

          {error && (
            <div className="mb-4 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">
              Identifiant ou mot de passe incorrect.
            </div>
          )}

          <form action={loginAction} className="flex flex-col gap-3.5">
            <input type="hidden" name="next" value={next} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-muted">Identifiant</span>
              <div className="relative">
                <span className="absolute left-3.5 top-0 h-12 flex items-center text-muted-2 pointer-events-none">
                  <UserIcon size={18} />
                </span>
                <input
                  name="username"
                  autoComplete="username"
                  placeholder={v.identifierPlaceholder}
                  className="h-12 w-full border border-line rounded-xl pl-11 pr-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                />
              </div>
            </label>
            <PasswordField name="password" label="Mot de passe" autoComplete="current-password" icon={<LockIcon size={18} />} />
            <SubmitButton
              pendingLabel="Connexion…"
              className="h-12 border-none rounded-xl text-white text-[15px] font-bold cursor-pointer mt-1.5 bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
            >
              {v.buttonLabel}
            </SubmitButton>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-line-soft" />
            <span className="text-[11px] text-muted-2 uppercase tracking-[0.08em]">ou</span>
            <div className="flex-1 h-px bg-line-soft" />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-bg px-3.5 py-3">
            <UserIcon size={16} className="text-muted-2 shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-muted leading-snug">Accès oublié ? Contacte Marvyn.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
