import Link from "next/link";
import { AuthCardShell } from "@/components/parent/AuthCardShell";
import { SubmitButton } from "@/components/SubmitButton";
import { UserIcon } from "@/components/parent/icons";
import { requestResetAction } from "./actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;

  return (
    <AuthCardShell title="Mot de passe oublié" subtitle="Indiquez votre identifiant ou votre email pour recevoir un lien de réinitialisation.">
      <div className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
        Mot de passe oublié
      </div>

      {sent === "1" ? (
        <div className="mt-4">
          <p className="text-[13.5px] text-[#16181c] leading-relaxed">
            Si un compte correspond à ces informations, un email avec un lien de réinitialisation vient d&apos;être envoyé.
          </p>
          <p className="text-[12.5px] text-[#9A9DA3] mt-2">Ce lien est valable pendant 30 minutes.</p>
          <Link
            href="/parent/login"
            className="mt-5 h-11 rounded-xl border border-[#E7E7E2] text-[14px] font-semibold flex items-center justify-center text-[#16181c]"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form action={requestResetAction} className="flex flex-col gap-3.5 mt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-[#6E7178]">Identifiant ou email</span>
            <div className="relative">
              <span className="absolute left-3.5 top-0 h-12 flex items-center text-[#9A9DA3] pointer-events-none">
                <UserIcon size={18} />
              </span>
              <input
                name="identifier"
                autoComplete="username"
                required
                placeholder="votre identifiant ou email"
                className="h-12 w-full border border-[#E7E7E2] rounded-xl pl-11 pr-3.5 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </div>
          </label>
          <SubmitButton
            pendingLabel="Envoi…"
            className="h-12 border-none rounded-xl text-white text-[15px] font-bold cursor-pointer mt-1.5 bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
          >
            Envoyer le lien de réinitialisation
          </SubmitButton>
          <Link href="/parent/login" className="text-center text-[12.5px] text-[#6E7178] font-semibold mt-1">
            Retour à la connexion
          </Link>
        </form>
      )}
    </AuthCardShell>
  );
}
