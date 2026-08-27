"use client";

import { useActionState } from "react";
import {
  sendInvitationAction,
  resendInvitationAction,
  sendPasswordResetAction,
  setParentAccountActive,
  deleteParentAccountAction,
  type InviteActionResult,
} from "@/app/(app)/joueurs/[id]/parent-account-actions";
import type { FamilyAccessStatus } from "@/lib/parent-invitation-status";
import { FAMILY_ACCESS_STATUS_LABEL } from "@/lib/parent-invitation-status";

type Account = { id: string; username: string; active: boolean } | null;
type LatestInvitation = { sentAt: Date | null; expiresAt: Date } | null;

const STATUS_TONE: Record<FamilyAccessStatus, { color: string; background: string }> = {
  missing_email: { color: "#9A9DA3", background: "#F0F0EC" },
  ready: { color: "#3C6E9F", background: "#EBF2F8" },
  sent: { color: "#C97A17", background: "#FBF1E4" },
  expired: { color: "#C4362C", background: "#FBEDEB" },
  activated: { color: "#3F8F5B", background: "#ECF5EF" },
  disabled: { color: "#C4362C", background: "#FBEDEB" },
};

export function ParentAccountPanel({
  playerId,
  playerName,
  parentEmail,
  account,
  status,
  latestInvitation,
}: {
  playerId: string;
  playerName: string;
  parentEmail: string | null;
  account: Account;
  status: FamilyAccessStatus;
  latestInvitation: LatestInvitation;
}) {
  const [inviteResult, inviteFormAction, inviting] = useActionState<InviteActionResult | null, FormData>(sendInvitationAction, null);
  const tone = STATUS_TONE[status];

  return (
    <div className="bg-surface border border-line rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Accès famille</span>
        <span className="flex-1" />
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ color: tone.color, background: tone.background }}>
          {FAMILY_ACCESS_STATUS_LABEL[status]}
        </span>
      </div>

      {inviteResult && !inviteResult.ok && <div className="text-[12.5px] text-red mb-2">{inviteResult.error}</div>}
      {inviteResult?.ok && <div className="text-[12.5px] text-green mb-2">Invitation envoyée à {inviteResult.email}.</div>}

      {status === "missing_email" && (
        <div className="text-[12.5px] text-muted">Renseigne l&apos;email du parent ci-dessus pour pouvoir envoyer une invitation.</div>
      )}

      {status === "ready" && (
        <form action={inviteFormAction}>
          <input type="hidden" name="playerId" value={playerId} />
          <button
            type="submit"
            disabled={inviting}
            className="w-full h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] disabled:opacity-60"
          >
            {inviting ? "Envoi…" : `Envoyer l'invitation à ${parentEmail}`}
          </button>
        </form>
      )}

      {(status === "sent" || status === "expired") && (
        <div className="flex flex-col gap-2">
          <div className="text-[12.5px] text-ink-soft">
            {status === "sent" && latestInvitation?.sentAt
              ? `Invitation envoyée le ${formatDate(latestInvitation.sentAt)}, valable jusqu'au ${formatDate(latestInvitation.expiresAt)}.`
              : "Le lien d'activation précédent a expiré."}
          </div>
          <form action={resendInvitationAction.bind(null, playerId)}>
            <button type="submit" className="w-full h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Renvoyer l&apos;invitation
            </button>
          </form>
        </div>
      )}

      {account && (status === "activated" || status === "disabled") && (
        <div className="flex flex-col gap-2">
          <div className="text-[12.5px] text-ink-soft">
            Identifiant : <span className="font-mono font-semibold">{account.username}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {status === "activated" && (
              <form action={sendPasswordResetAction.bind(null, account.id)}>
                <button type="submit" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink">
                  Envoyer un lien de réinitialisation
                </button>
              </form>
            )}
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
                if (!window.confirm(`Supprimer définitivement le compte famille de ${playerName} ?\n\nLe parent perdra l'accès immédiatement. Une nouvelle invitation pourra être envoyée plus tard si besoin.`)) {
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

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
