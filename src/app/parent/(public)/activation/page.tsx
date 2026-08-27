import { cookies } from "next/headers";
import Link from "next/link";
import { checkActivationToken } from "@/lib/parent-activation";
import { AuthCardShell } from "@/components/parent/AuthCardShell";
import { PasswordField } from "@/components/parent/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { LockIcon, ShieldCheckIcon } from "@/components/parent/icons";
import { activateAction } from "./actions";

const COOKIE_NAME = "parent-activation";

const ERROR_MESSAGES: Record<string, string> = {
  court: "Le mot de passe doit contenir au moins 10 caractères.",
  diff: "Les deux mots de passe ne correspondent pas.",
  invalid: "Ce lien d'activation n'est plus valide. Rechargez la page pour voir le détail.",
};

export default async function ActivationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (!token) {
    return (
      <AuthCardShell title="Votre espace famille sur Onzevo" subtitle="Activez l'accès que le club vous a envoyé.">
        <ErrorState
          title="Lien invalide"
          detail="Ce lien d'activation n'est pas reconnu. Ouvrez-le directement depuis l'email reçu du club, sans le copier ailleurs."
        />
      </AuthCardShell>
    );
  }

  const check = await checkActivationToken(token);

  if (check.status === "expired") {
    return (
      <AuthCardShell title="Votre espace famille sur Onzevo" subtitle="Activez l'accès que le club vous a envoyé.">
        <ErrorState title="Ce lien d'activation n'est plus valide" detail="Il a expiré (valable 72 heures). Contactez votre club pour recevoir un nouveau lien." />
      </AuthCardShell>
    );
  }
  if (check.status === "used") {
    return (
      <AuthCardShell title="Votre espace famille sur Onzevo" subtitle="Activez l'accès que le club vous a envoyé.">
        <div>
          <div className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
            Votre compte est déjà activé
          </div>
          <p className="text-[13.5px] text-[#6E7178] mt-2 leading-relaxed">Vous pouvez vous connecter directement.</p>
          <Link
            href="/parent/login"
            className="mt-5 h-12 rounded-xl text-white text-[15px] font-bold flex items-center justify-center bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
          >
            Se connecter
          </Link>
        </div>
      </AuthCardShell>
    );
  }
  if (check.status === "revoked") {
    return (
      <AuthCardShell title="Votre espace famille sur Onzevo" subtitle="Activez l'accès que le club vous a envoyé.">
        <ErrorState title="Ce lien n'est plus valide" detail="Un lien plus récent a peut-être été envoyé — vérifiez vos emails, ou contactez votre club." />
      </AuthCardShell>
    );
  }
  if (check.status === "invalid") {
    return (
      <AuthCardShell title="Votre espace famille sur Onzevo" subtitle="Activez l'accès que le club vous a envoyé.">
        <ErrorState title="Lien invalide" detail="Ce lien d'activation n'est pas reconnu. Contactez votre club pour en recevoir un nouveau." />
      </AuthCardShell>
    );
  }

  const childDisplay = `${check.playerFirstName} ${check.playerLastName.toUpperCase()}`;

  return (
    <AuthCardShell
      title="Bienvenue sur votre espace famille"
      subtitle="Choisissez votre mot de passe pour activer votre accès Onzevo."
    >
      <div className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
        Bienvenue sur Onzevo
      </div>
      <div className="mt-3 rounded-xl bg-[#F6F6F4] px-3.5 py-3">
        <div className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">Votre accès pour</div>
        <div className="text-[15px] font-bold text-[#16181c] mt-0.5">{childDisplay}</div>
        <div className="text-[12.5px] text-[#6E7178] mt-0.5">{check.clubName}</div>
      </div>

      <div className="h-px bg-[#EFEFEC] my-5" />

      <div className="text-[13px] font-semibold text-[#6E7178] mb-3">Créer votre mot de passe</div>

      {error && ERROR_MESSAGES[error] && (
        <div className="mb-3.5 rounded-xl border border-red/30 bg-red-bg px-3 py-2.5 text-[13px] text-red">{ERROR_MESSAGES[error]}</div>
      )}

      <form action={activateAction} className="flex flex-col gap-3.5">
        <PasswordField name="password" label="Nouveau mot de passe" autoComplete="new-password" icon={<LockIcon size={18} />} />
        <PasswordField name="confirm" label="Confirmation" autoComplete="new-password" icon={<LockIcon size={18} />} />
        <p className="text-[11.5px] text-[#9A9DA3] -mt-1.5">Au moins 10 caractères — une phrase facile à retenir fonctionne très bien.</p>
        <SubmitButton
          pendingLabel="Activation…"
          className="h-12 border-none rounded-xl text-white text-[15px] font-bold cursor-pointer mt-1.5 bg-[linear-gradient(135deg,#1f8a58,#00c97a)]"
        >
          ACTIVER MON ESPACE FAMILLE
        </SubmitButton>
      </form>
    </AuthCardShell>
  );
}

function ErrorState({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-xl bg-red-bg flex items-center justify-center text-red mb-3">
        <ShieldCheckIcon size={20} />
      </div>
      <div className="text-[18px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
        {title}
      </div>
      <p className="text-[13.5px] text-[#6E7178] mt-2 leading-relaxed">{detail}</p>
      <Link
        href="/parent/login"
        className="mt-5 h-11 rounded-xl border border-[#E7E7E2] text-[14px] font-semibold flex items-center justify-center text-[#16181c]"
      >
        Retour à la connexion
      </Link>
    </div>
  );
}
