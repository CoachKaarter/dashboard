export function teamTone(code: string): "blue" | "purple" {
  return code.startsWith("U13") ? "blue" : "purple";
}

export function statutTone(status: string): "green" | "red" | "orange" | "neutral" {
  if (status === "Actif") return "green";
  if (status === "Blessé") return "red";
  if (status === "Malade") return "orange";
  return "neutral";
}

export function codeTone(code: string): "green" | "orange" | "neutral" | "red" {
  if (code === "P") return "green";
  if (code === "R") return "orange";
  if (code === "AJ") return "neutral";
  return "red"; // ANJ, B
}

export const CODE_LABELS: Record<string, string> = {
  P: "Présent",
  R: "Retard",
  AJ: "Absent justifié",
  ANJ: "Absent non justifié",
  B: "Blessé",
};

const DAY_LABELS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const DAY_LABELS_SHORT3 = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const MONTH_LABELS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function formatDayShort(d: Date): string {
  return DAY_LABELS_SHORT3[d.getDay()];
}

export function formatDateLong(d: Date): string {
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

export function formatDateFull(d: Date): string {
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatToday(d: Date): string {
  return `${DAY_LABELS_SHORT3[d.getDay()]}. ${d.getDate()} ${MONTH_LABELS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

export function minuteTone(m: number): "none" | "low" | "mid" | "good" | "great" {
  if (m === 0) return "none";
  if (m < 20) return "low";
  if (m < 35) return "mid";
  if (m < 55) return "good";
  return "great";
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
