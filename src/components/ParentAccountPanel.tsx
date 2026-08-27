"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/CopyButton";
import {
  createParentAccountAction,
  resetParentPasswordAction,
  setParentAccountActive,
  deleteParentAccountAction,
} from "@/app/(app)/joueurs/[id]/parent-account-actions";

type Account = { id: string; username: string; active: boolean } | null;

export function ParentAccountPanel({
  playerId,
  playerName,
  account,
}: {
  playerId: string;
  playerName: string;
  account: Account;
}) {
  const [createResult, createFormAction, creating] = useActionState(createParentAccountAction, null);
  const [resetResult, resetFormAction, resetting] = useActionState(resetParentPasswordAction, null);

  const createCredentials = createResult && "username" in createResult ? createResult : null;
  const resetCredentials = resetResult && "username" in resetResult ? resetResult : null;
  const credentials = createCredentials ?? resetCredentials;
  const errorMsg =
    createResult && "error" in createResult ? createResult.error : resetResult && "error" in resetResult ? resetResult.error : null;

  return (
    <div className="bg-surface border border-line rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Compte famille</span>
        <span className="flex-1" />
        {account ? (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded"
            style={{ color: account.active ? "#3F8F5B" : "#C4362C", background: account.active ? "#ECF5EF" : "#FBEDEB" }}
          >
            {account.active ? "Actif" : "Désactivé"}
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded text-muted bg-line-soft">Aucun compte</span>
        )}
      </div>

      {errorMsg && <div className="text-[12.5px] text-red mb-2">{errorMsg}</div>}

      {credentials && (
        <div className="mb-3 rounded-md border border-blue/25 bg-blue-bg p-3 text-[12.5px]">
          <div className="font-semibold mb-1">{playerName}</div>
          <div>
            Identifiant : <span className="font-mono font-bold">{credentials.username}</span>
          </div>
          <div>
            Mot de passe temporaire : <span className="font-mono font-bold">{credentials.tempPassword}</span>
          </div>
          <EmailStatusLine status={credentials.emailStatus} error={credentials.emailError} />
          <CopyButton
            text={`${playerName}\nIdentifiant : ${credentials.username}\nMot de passe temporaire : ${credentials.tempPassword}`}
            label="Copier les informations"
            className="mt-2 h-8 px-3 rounded-md bg-ink text-white text-[11.5px] font-semibold hover:bg-[#2A2E36]"
          />
        </div>
      )}

      {!account && (
        <form action={createFormAction}>
          <input type="hidden" name="playerId" value={playerId} />
          <button
            type="submit"
            disabled={creating}
            className="w-full h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] disabled:opacity-60"
          >
            {creating ? "Création…" : "Créer le compte"}
          </button>
        </form>
      )}

      {account && (
        <div className="flex flex-col gap-2">
          <div className="text-[12.5px] text-ink-soft">
            Identifiant : <span className="font-mono font-semibold">{account.username}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <form action={resetFormAction}>
              <input type="hidden" name="accountId" value={account.id} />
              <button
                type="submit"
                disabled={resetting}
                className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink disabled:opacity-60"
              >
                Réinitialiser le mot de passe
              </button>
            </form>
            <form action={setParentAccountActive.bind(null, account.id, !account.active)}>
              <button
                type="submit"
                className={`h-8 px-3 border rounded-md text-xs font-semibold ${
                  account.active ? "border-line text-red hover:border-red" : "border-line text-green hover:border-green"
                }`}
              >
                {account.active ? "Désactiver le compte" : "Réactiver le compte"}
              </button>
            </form>
            <form
              action={deleteParentAccountAction.bind(null, account.id)}
              onSubmit={(e) => {
                if (!window.confirm(`Supprimer définitivement le compte famille de ${playerName} ?\n\nLe parent perdra l'accès immédiatement. Un nouveau compte pourra être recréé plus tard si besoin.`)) {
                  e.preventDefault();
                }
              }}
            >
              <button type="submit" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-red hover:border-red">
                Supprimer le compte
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailStatusLine({ status, error }: { status: "sent" | "failed" | "none"; error?: string }) {
  if (status === "sent") {
    return <div className="mt-1.5 text-green font-semibold">✓ Email envoyé au parent avec ces identifiants.</div>;
  }
  if (status === "failed") {
    return (
      <div className="mt-1.5 text-red font-semibold">
        Échec de l&apos;envoi de l&apos;email{error ? ` (${error})` : ""} — transmets ces identifiants toi-même.
      </div>
    );
  }
  return <div className="mt-1.5 text-muted">Aucun email parent renseigné — transmets ces identifiants toi-même.</div>;
}
