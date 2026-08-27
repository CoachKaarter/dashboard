import { cookies } from "next/headers";
import Link from "next/link";
import { checkResetToken } from "@/lib/parent-password-reset";
import { AuthCardShell } from "@/components/parent/AuthCardShell";
import { PasswordField } from "@/components/parent/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { LockIcon, ShieldCheckIcon } from "@/components/parent/icons";
import { resetPasswordAction } from "./actions";

const COOKIE_NAME = "parent-reset";

const ERROR_MESSAGES: Record<string, string> = {
  court: "Le mot de passe doit contenir au moins 10 caractères.",
  diff: "Les deux mots de passe ne correspondent pas.",
  invalid: "Ce lien n'est plus valide. Demandez-en un nouveau.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (!token) {
    return (
      <AuthCardShell title="Réinitialiser votre mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre espace famille Onzevo.">
        <ErrorState detail="Ce lien n'est pas reconnu. Ouvrez-le directement depuis l'email reçu, ou demandez-en un nouveau." />
      </AuthCardShell>
    );
  }

  const check = await checkResetToken(token);

  if (check.status !== "valid") {
    const detail =
      check.status === "expired"
        ? "Ce lien a expiré (valable 30 minutes). Demandez-en un nouveau."
        : check.status === "used"
          ? "Ce lien a déjà été utilisé — votre mot de passe a déjà été changé."
          : "Ce lien n'est plus valide. Demandez-en un nouveau.";
    return (
      <AuthCardShell title="Réinitialiser votre mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre espace famille Onzevo.">
        <ErrorState detail={detail} />
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell title="Choisir un nouveau mot de passe" subtitle="Votre nouveau mot de passe sera actif immédiatement.">
      <div className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
        Nouveau mot de passe
      </div>

      {error && ERROR_MESSAGES[error] && (
        <div className="mt-3.5 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">{ERROR_MESSAGES[error]}</div>
      )}

      <form action={resetPasswordAction} className="flex flex-col gap-3.5 mt-4">
        <PasswordField name="password" label="Nouveau mot de passe" autoComplete="new-password" icon={<LockIcon size={18} />} />
        <PasswordField name="confirm" label="Confirmation" autoComplete="new-password" icon={<LockIcon size={18} />} />
        <p className="text-[11.5px] text-[#9A9DA3] -mt-1.5">Au moins 10 caractères.</p>
        <SubmitButton
          pendingLabel="Enregistrement…"
          className="h-12 border-none rounded-xl text-white text-[15px] font-bold cursor-pointer mt-1.5 bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
        >
          CHOISIR CE MOT DE PASSE
        </SubmitButton>
      </form>
    </AuthCardShell>
  );
}

function ErrorState({ detail }: { detail: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-xl bg-red-bg flex items-center justify-center text-red mb-3">
        <ShieldCheckIcon size={20} />
      </div>
      <div className="text-[18px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
        Lien de réinitialisation invalide
      </div>
      <p className="text-[13.5px] text-[#6E7178] mt-2 leading-relaxed">{detail}</p>
      <Link
        href="/parent/mot-de-passe-oublie"
        className="mt-5 h-11 rounded-xl border border-[#E7E7E2] text-[14px] font-semibold flex items-center justify-center text-[#16181c]"
      >
        Demander un nouveau lien
      </Link>
    </div>
  );
}
