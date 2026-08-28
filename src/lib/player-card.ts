// Carte joueur façon FIFA (Espace Parent) — construite exclusivement à
// partir de l'évaluation la plus récente (EvaluationScore, échelle 1-5 sur
// 4 axes : technique/tactique/physique/comportement — voir
// src/app/(app)/evaluations/actions.ts). Aucune métrique inventée : pas de
// mélange avec les statistiques de match, pas de note "vitesse"/"tir" qui
// n'existe pas dans l'outil. Jamais de photo (choix explicite du club) —
// la carte s'appuie sur les initiales, comme partout ailleurs dans l'app.
import { POSITIONS } from "@/lib/constants";

export type CardStatKey = "technique" | "tactique" | "physique" | "comportement";

export type CardStat = { key: CardStatKey; label: string; value: number };

export type PlayerCardRating = { overall: number; stats: CardStat[] };

const STAT_LABELS: Record<CardStatKey, string> = {
  technique: "TEC",
  tactique: "TAC",
  physique: "PHY",
  comportement: "MEN",
};

// Barème club (1 à 5) → échelle d'affichage façon FIFA (40 à 99). Un 1/5
// n'affiche jamais 0 — une évaluation existe, elle a une valeur — et un 5/5
// plafonne à 99, jamais 100 (aucune carte n'est "parfaite").
const SCALE_MIN = 1;
const SCALE_MAX = 5;
const RATING_MIN = 40;
const RATING_MAX = 99;

function scaleToRating(value: number): number {
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
  const ratio = (clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  return Math.round(RATING_MIN + ratio * (RATING_MAX - RATING_MIN));
}

/** null quand le joueur n'a encore aucune évaluation — jamais de carte "vide" inventée à partir de rien. */
export function computePlayerCardRating(
  evaluation: { technique: number; tactique: number; physique: number; comportement: number } | null
): PlayerCardRating | null {
  if (!evaluation) return null;
  const keys: CardStatKey[] = ["technique", "tactique", "physique", "comportement"];
  const stats = keys.map((key) => ({ key, label: STAT_LABELS[key], value: scaleToRating(evaluation[key]) }));
  const overall = Math.round(stats.reduce((sum, s) => sum + s.value, 0) / stats.length);
  return { overall, stats };
}

const POSITION_ABBREVIATIONS: Record<string, string> = {
  Gardien: "GB",
  "Défenseur central": "DC",
  Latéral: "LAT",
  "Milieu défensif": "MDC",
  "Milieu relayeur": "MC",
  "Milieu offensif": "MOC",
  Ailier: "AIL",
  Attaquant: "ATT",
  Polyvalent: "POL",
};

/** Retombe sur les 3 premières lettres en majuscules si un poste n'a pas d'abréviation dédiée (ne bloque jamais l'affichage). */
export function abbreviatePosition(position: string): string {
  return POSITION_ABBREVIATIONS[position] ?? position.slice(0, 3).toUpperCase();
}

// Vérifie à la compilation/aux tests que chaque poste connu a bien une
// abréviation dédiée, sans dupliquer POSITIONS ici.
export const KNOWN_POSITIONS = POSITIONS;
