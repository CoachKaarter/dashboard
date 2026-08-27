import { OnzevoMark } from "@/components/OnzevoMark";
import { ShieldCheckIcon } from "@/components/parent/icons";

/**
 * Shared navy-hero / floating-card shell for every unauthenticated Parent
 * screen that isn't the main login (activation, mot de passe oublié,
 * réinitialisation) — same visual language (§61 : "respecter le langage
 * Onzevo"), trimmed of the marketing feature list that only makes sense on
 * the primary login page.
 */
export function AuthCardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1fr_1.1fr] lg:h-screen lg:min-h-0" style={{ fontFamily: "var(--font-parent-body)" }}>
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
        </div>

        <div className="relative z-10">
          <OnzevoMark variant="light" />
        </div>

        <div className="relative z-10">
          <h1
            className="text-[28px] sm:text-[34px] lg:text-[38px] font-bold leading-[1.1] tracking-[-0.02em] max-w-[420px] text-pretty"
            style={{ fontFamily: "var(--font-parent-display)" }}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-4 text-white/70 text-[14.5px] max-w-[400px] leading-relaxed">{subtitle}</p>}
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
        <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] border border-[#E7E7E2] p-7">{children}</div>
      </div>
    </div>
  );
}
