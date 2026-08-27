import { Resend } from "resend";

// Onzevo n'a pas de nom de domaine spécifique au club pour l'envoi — le lien
// et l'adresse d'expédition sont ceux du produit (onzevo.website), jamais un
// domaine du club, qui n'existe pas forcément.
const APP_URL = process.env.APP_URL ?? "https://onzevo.website";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Onzevo <onboarding@onzevo.website>";

// null tant que RESEND_API_KEY n'est pas configurée (dev local, ou avant que
// le club ait fini de vérifier son domaine d'envoi) — les fonctions send*
// le traitent comme un échec explicite plutôt que de planter l'appelant.
function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendViaResend(input: { to: string; subject: string; text: string; html: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "Service d'envoi d'email non configuré (RESEND_API_KEY manquante)." };
  try {
    const result = await client.emails.send({ from: FROM_EMAIL, to: input.to, subject: input.subject, text: input.text, html: input.html });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------
// Mise en page commune — header Onzevo (+ club si logo configuré), carte
// centrale claire, CTA dégradé, pied de page sobre. Jamais de mot de passe,
// jamais de jeton, jamais d'information sportive sensible (§50-52) : ces
// emails ne contiennent que le nom du club, le nom de l'enfant, et un lien.
// ---------------------------------------------------------------------
function emailShell(input: { clubName: string; clubLogoUrl?: string | null; bodyHtml: string; footerExtra?: string }) {
  return `
<div style="font-family:Helvetica,Arial,sans-serif;background:#F6F6F4;padding:32px 16px;">
  <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E7E7E2;">
    <div style="background:#171f3e;padding:20px 28px;display:table;width:100%;box-sizing:border-box;">
      <img src="${APP_URL}/onzevo-logo-light.png" alt="Onzevo" height="22" style="height:22px;width:auto;display:block;" />
      ${
        input.clubLogoUrl
          ? `<img src="${input.clubLogoUrl}" alt="${escapeHtml(input.clubName)}" height="26" style="height:26px;width:auto;display:block;margin-top:10px;border-radius:6px;" />`
          : `<div style="margin-top:8px;color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;letter-spacing:0.04em;">${escapeHtml(input.clubName)}</div>`
      }
    </div>
    <div style="padding:28px;">
      ${input.bodyHtml}
    </div>
  </div>
  <div style="max-width:460px;margin:16px auto 0;text-align:center;font-size:11px;color:#9A9DA3;line-height:1.6;">
    Onzevo — Le club, en mouvement.<br/>
    Cet email concerne l'accès famille de ${escapeHtml(input.clubName)}.<br/>
    ${input.footerExtra ? `${input.footerExtra}<br/>` : ""}
    Besoin d'aide ? Contactez votre club.
  </div>
</div>`.trim();
}

function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:block;text-align:center;background:linear-gradient(135deg,#1f8a58,#00c97a);color:#ffffff;text-decoration:none;font-weight:700;font-size:14.5px;padding:14px;border-radius:12px;">${label}</a>
      <p style="margin:14px 0 0;font-size:11.5px;color:#9A9DA3;line-height:1.5;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
        <span style="word-break:break-all;color:#6E7178;">${url}</span>
      </p>`;
}

// =======================================================================
// Invitation famille — remplace l'ancien envoi d'identifiant + mot de passe
// temporaire (voir git history : buildParentCredentialsEmail). Le club ne
// donne plus qu'un DROIT D'ACCÈS ; le mot de passe est choisi par le parent
// lui-même à l'activation. Texte et objet repris tels que spécifiés.
// =======================================================================
export type ParentInvitationEmailInput = {
  to: string;
  clubName: string;
  clubLogoUrl?: string | null;
  playerFirstName: string;
  playerLastName: string;
  activationUrl: string;
};

export function buildParentInvitationEmail(input: ParentInvitationEmailInput) {
  const subject = "Votre espace famille Onzevo est prêt";
  const childDisplay = `${input.playerFirstName} ${input.playerLastName.toUpperCase()}`;

  const text = [
    `Bonjour,`,
    ``,
    `Le ${input.clubName} met désormais à votre disposition Onzevo, son espace numérique dédié aux familles.`,
    ``,
    `Votre espace est prêt pour : ${childDisplay}`,
    ``,
    `Depuis Onzevo, vous pourrez notamment retrouver :`,
    `- Planning de la semaine — Les entraînements et rendez-vous de votre enfant.`,
    `- Disponibilités — Renseignez les présences aux séances et au week-end.`,
    `- Convocations — Retrouvez automatiquement la convocation de votre enfant lorsqu'elle est publiée.`,
    `- Informations du club — Horaires, lieux, annonces et informations utiles.`,
    ``,
    `VOTRE ESPACE EST PRÊT`,
    `Pour activer votre compte et choisir votre mot de passe :`,
    input.activationUrl,
    ``,
    `Ce lien est personnel et valable pendant 72 heures.`,
    `Pour votre sécurité, ne transférez pas cet email.`,
    ``,
    `À bientôt sur Onzevo,`,
    `Le staff, ${input.clubName}`,
  ].join("\n");

  const benefits = [
    ["Planning de la semaine", "Les entraînements et rendez-vous de votre enfant."],
    ["Disponibilités", "Renseignez les présences aux séances et au week-end."],
    ["Convocations", "Retrouvez automatiquement la convocation de votre enfant lorsqu'elle est publiée."],
    ["Informations du club", "Horaires, lieux, annonces et informations utiles."],
  ];

  const bodyHtml = `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3F8F5B;">Bienvenue sur Onzevo</p>
      <p style="margin:0 0 16px;font-size:15px;color:#16181c;line-height:1.55;">
        Le <strong>${escapeHtml(input.clubName)}</strong> met désormais à votre disposition Onzevo, son espace numérique dédié aux familles.
        Votre espace famille est prêt.
      </p>
      <div style="background:#F6F6F4;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9A9DA3;margin-bottom:2px;">Votre espace est prêt pour</div>
        <div style="font-size:16px;font-weight:700;color:#16181c;">${escapeHtml(childDisplay)}</div>
      </div>
      <div style="margin-bottom:22px;">
        ${benefits
          .map(
            ([title, desc]) => `
        <div style="margin-bottom:12px;">
          <div style="font-size:13.5px;font-weight:700;color:#16181c;">${escapeHtml(title)}</div>
          <div style="font-size:13px;color:#6E7178;line-height:1.5;">${escapeHtml(desc)}</div>
        </div>`
          )
          .join("")}
      </div>
      ${ctaButton(input.activationUrl, "ACTIVER MON ESPACE FAMILLE")}
      <p style="margin:18px 0 0;font-size:12px;color:#9A9DA3;line-height:1.5;">
        Ce lien est personnel et valable pendant 72 heures. Pour votre sécurité, ne transférez pas cet email.
      </p>`;

  const html = emailShell({ clubName: input.clubName, clubLogoUrl: input.clubLogoUrl, bodyHtml });

  return { subject, text, html };
}

export async function sendParentInvitationEmail(input: ParentInvitationEmailInput) {
  const { subject, text, html } = buildParentInvitationEmail(input);
  return sendViaResend({ to: input.to, subject, text, html });
}

// =======================================================================
// Mot de passe oublié (Parent) — même charte, expiration courte (30 min).
// =======================================================================
export type ParentPasswordResetEmailInput = {
  to: string;
  clubName: string;
  clubLogoUrl?: string | null;
  resetUrl: string;
};

export function buildParentPasswordResetEmail(input: ParentPasswordResetEmailInput) {
  const subject = "Réinitialisez votre mot de passe Onzevo";

  const text = [
    `Bonjour,`,
    ``,
    `Une demande de réinitialisation du mot de passe de votre espace famille Onzevo a été effectuée.`,
    ``,
    input.resetUrl,
    ``,
    `Ce lien est valable pendant 30 minutes.`,
    ``,
    `Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.`,
  ].join("\n");

  const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#16181c;line-height:1.55;">
        Une demande de réinitialisation du mot de passe de votre espace famille Onzevo a été effectuée.
      </p>
      ${ctaButton(input.resetUrl, "CHOISIR UN NOUVEAU MOT DE PASSE")}
      <p style="margin:18px 0 0;font-size:12px;color:#9A9DA3;line-height:1.5;">
        Ce lien est valable pendant 30 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
      </p>`;

  const html = emailShell({ clubName: input.clubName, clubLogoUrl: input.clubLogoUrl, bodyHtml });

  return { subject, text, html };
}

export async function sendParentPasswordResetEmail(input: ParentPasswordResetEmailInput) {
  const { subject, text, html } = buildParentPasswordResetEmail(input);
  return sendViaResend({ to: input.to, subject, text, html });
}
