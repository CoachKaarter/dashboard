import { Resend } from "resend";

// Onzevo n'a pas de nom de domaine spécifique au club pour l'envoi — le lien
// et l'adresse d'expédition sont ceux du produit (onzevo.website), jamais un
// domaine du club, qui n'existe pas forcément.
const APP_URL = process.env.APP_URL ?? "https://onzevo.website";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Onzevo <onboarding@onzevo.website>";

// null tant que RESEND_API_KEY n'est pas configurée (dev local, ou avant que
// le club ait fini de vérifier son domaine d'envoi) — sendParentCredentialsEmail
// le traite comme un échec explicite plutôt que de planter l'appelant, pour
// que la création de compte reste possible (et les identifiants affichés à
// l'écran) même sans email fonctionnel.
function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

export type ParentCredentialsEmailInput = {
  to: string;
  clubName: string;
  playerFirstName: string;
  playerLastName: string;
  username: string;
  tempPassword: string;
};

export function buildParentCredentialsEmail(input: ParentCredentialsEmailInput) {
  const loginUrl = `${APP_URL}/parent/login`;
  const subject = `Votre accès à l'espace famille — ${input.clubName}`;

  const text = [
    `Bonjour,`,
    ``,
    `Un accès à l'espace famille de ${input.clubName} a été créé pour ${input.playerFirstName} ${input.playerLastName}.`,
    ``,
    `Identifiant : ${input.username}`,
    `Mot de passe temporaire : ${input.tempPassword}`,
    ``,
    `Connectez-vous sur ${loginUrl} — un nouveau mot de passe vous sera demandé dès la première connexion.`,
    ``,
    `— Propulsé par Onzevo`,
  ].join("\n");

  const html = `
<div style="font-family:Helvetica,Arial,sans-serif;background:#F6F6F4;padding:32px 16px;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E7E7E2;">
    <div style="background:#171f3e;padding:20px 28px;">
      <img src="${APP_URL}/onzevo-logo-light.png" alt="Onzevo" height="22" style="height:22px;width:auto;display:block;" />
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 14px;font-size:15px;color:#16181c;">Bonjour,</p>
      <p style="margin:0 0 20px;font-size:14.5px;color:#3a3d43;line-height:1.55;">
        Un accès à l'espace famille de <strong>${escapeHtml(input.clubName)}</strong> a été créé pour
        <strong>${escapeHtml(input.playerFirstName)} ${escapeHtml(input.playerLastName)}</strong>.
      </p>
      <div style="background:#F6F6F4;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9A9DA3;margin-bottom:2px;">Identifiant</div>
        <div style="font-family:ui-monospace,monospace;font-size:16px;font-weight:700;color:#16181c;margin-bottom:14px;">${escapeHtml(input.username)}</div>
        <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9A9DA3;margin-bottom:2px;">Mot de passe temporaire</div>
        <div style="font-family:ui-monospace,monospace;font-size:16px;font-weight:700;color:#16181c;">${escapeHtml(input.tempPassword)}</div>
      </div>
      <a href="${loginUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#1f8a58,#00c97a);color:#ffffff;text-decoration:none;font-weight:700;font-size:14.5px;padding:13px;border-radius:12px;">
        Accéder à l'espace famille
      </a>
      <p style="margin:18px 0 0;font-size:12.5px;color:#6E7178;line-height:1.5;">
        Un nouveau mot de passe vous sera demandé dès la première connexion.
      </p>
    </div>
  </div>
  <div style="text-align:center;margin-top:16px;font-size:11px;color:#9A9DA3;">Propulsé par Onzevo</div>
</div>`.trim();

  return { subject, text, html, loginUrl };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendParentCredentialsEmail(
  input: ParentCredentialsEmailInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "Service d'envoi d'email non configuré (RESEND_API_KEY manquante)." };

  const { subject, text, html } = buildParentCredentialsEmail(input);
  try {
    const result = await client.emails.send({ from: FROM_EMAIL, to: input.to, subject, text, html });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
