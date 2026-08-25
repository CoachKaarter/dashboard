// Modèles des 2 messages "à copier" affichés au staff (boutons Copier sur
// /disponibilites et /week-end), éditables depuis /parametres. Un club qui
// n'a rien configuré (Club.availabilityMessageTemplate /
// convocationMessageTemplate à null) obtient exactement le texte par défaut
// ci-dessous — ces constantes SONT le texte par défaut, pas juste un exemple.

export const AVAILABILITY_MESSAGE_VARS = ["date_limite", "lien_parent", "resultats"] as const;
export const CONVOCATION_MESSAGE_VARS = ["date", "lien_parent", "lien_club"] as const;

// {{resultats}} is optional: wrapped in {{#resultats}}...{{/resultats}} so
// the whole "Voici les résultats du week-end :" paragraph disappears
// cleanly — title included — whenever the club has the feature off or no
// match is exploitable that weekend (src/lib/weekend-results.ts), instead
// of leaving an empty heading or a raw {{resultats}} token. See
// renderMessageTemplate below for exactly how the block is stripped/kept.
export const DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE = [
  "Bonjour à tous,",
  "",
  "{{#resultats}}",
  "Voici les résultats du week-end :",
  "",
  "{{resultats}}",
  "",
  "{{/resultats}}",
  "Les disponibilités pour la semaine à venir sont désormais ouvertes.",
  "",
  "Vous pouvez dès à présent renseigner la présence de votre enfant aux séances ainsi que sa disponibilité pour le prochain week-end directement depuis l'espace parents :",
  "",
  "{{lien_parent}}",
  "",
  "Merci de compléter les informations avant {{date_limite}} afin de nous permettre d'organiser au mieux les séances et les équipes du week-end.",
  "",
  "Bonne semaine à tous.",
  "",
  "Le staff U12/U13 🔵🔵",
].join("\n");

export const DEFAULT_CONVOCATION_MESSAGE_TEMPLATE = [
  "Bonjour à tous,",
  "",
  "Les convocations pour le week-end du {{date}} sont disponibles.",
  "",
  "Vous pouvez les consulter dès à présent depuis l'espace parents ainsi que sur le site du club.",
  "",
  "🔗 Espace parents : {{lien_parent}}",
  "🔗 Site du club : {{lien_club}}",
].join("\n");

// Optional-block support: {{#key}}...{{/key}} is kept (markers stripped,
// inner text preserved verbatim) when vars[key] is a non-empty string, and
// removed entirely — block plus its own trailing newline, so no orphaned
// blank line or leftover heading — when vars[key] is absent or "". This is
// the same engine used for plain {{key}} substitution below, not a second
// templating system: {{key}} tokens still get substituted, including ones
// left inside a kept block.
function stripOptionalBlocks(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{#(\w+)\}\}\n?([\s\S]*?)\{\{\/\1\}\}\n?/g, (_match, key: string, inner: string) =>
    vars[key] ? inner : ""
  );
}

export function renderMessageTemplate(template: string, vars: Record<string, string>): string {
  const withBlocksResolved = stripOptionalBlocks(template, vars);
  return Object.entries(vars).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(value), withBlocksResolved);
}
