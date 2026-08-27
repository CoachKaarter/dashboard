// Pure status computation for the "Accès familles" screen (§22-23 du
// cahier des charges invitation/activation) — no DB access here so it's
// directly unit-testable. One deliberate simplification versus the
// literal 8-status list requested: "À PRÉPARER" and "INVITATION PRÊTE"
// are collapsed into a single "ready" state. Reason: the raw invitation
// token must never be stored (only its hash) — so an invitation row can
// only usefully be created at the moment it's about to be emailed; a
// "prepared but not yet sent" row would hold a token nobody has, which is
// just dead state. "Envoyer les invitations" therefore creates AND sends
// in one step for every "ready" player. See rapport final for detail.
export type FamilyAccessStatus = "missing_email" | "ready" | "sent" | "expired" | "activated" | "disabled";

export type FamilyAccessInput = {
  parentEmail: string | null;
  account: { active: boolean } | null;
  latestInvitation: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date; sentAt: Date | null } | null;
};

export function computeFamilyAccessStatus(input: FamilyAccessInput, now: Date = new Date()): FamilyAccessStatus {
  if (input.account) return input.account.active ? "activated" : "disabled";

  if (!input.parentEmail) return "missing_email";

  const inv = input.latestInvitation;
  if (!inv || inv.revokedAt || inv.usedAt) return "ready";

  if (inv.expiresAt.getTime() <= now.getTime()) return "expired";
  return inv.sentAt ? "sent" : "ready";
}

export const FAMILY_ACCESS_STATUS_LABEL: Record<FamilyAccessStatus, string> = {
  missing_email: "Email parent manquant",
  ready: "Prêt à inviter",
  sent: "Invitation envoyée",
  expired: "Invitation expirée",
  activated: "Activé",
  disabled: "Compte désactivé",
};
