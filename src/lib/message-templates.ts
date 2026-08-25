// Modèles des 2 messages "à copier" affichés au staff (boutons Copier sur
// /disponibilites et /week-end), éditables depuis /parametres. Un club qui
// n'a rien configuré (Club.availabilityMessageTemplate /
// convocationMessageTemplate à null) obtient exactement le texte par défaut
// ci-dessous — ces constantes SONT le texte par défaut, pas juste un exemple.

export const AVAILABILITY_MESSAGE_VARS = ["date_limite", "lien_parent"] as const;
export const CONVOCATION_MESSAGE_VARS = ["date", "lien_parent", "lien_club"] as const;

export const DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE = [
  "Bonjour à tous,",
  "",
  "Les pointages de présence de la semaine sont désormais ouverts.",
  "",
  "Vous pouvez dès à présent renseigner les présences de votre enfant aux séances ainsi que sa disponibilité pour le week-end depuis l'espace parents.",
  "",
  "Merci de compléter les informations avant {{date_limite}}.",
  "",
  "🔗 {{lien_parent}}",
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

export function renderMessageTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(value), template);
}
