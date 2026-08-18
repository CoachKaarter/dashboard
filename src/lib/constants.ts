export const TEAM_FILTERS = ["Toutes", "U13", "U12", "U13A", "U13B", "U13C", "U12A", "U12B", "U12C"];

export const POSITIONS = [
  "Gardien",
  "Défenseur central",
  "Latéral",
  "Milieu défensif",
  "Milieu relayeur",
  "Milieu offensif",
  "Ailier",
  "Attaquant",
  "Polyvalent",
];

export const PLAYER_STATUSES = ["Actif", "Blessé", "Malade", "Incertain", "Reprise"];

export const EVAL_PERIODS = ["Septembre", "Décembre", "Mars", "Juin"];

export const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  DEBUT_SAISON: "Début de saison",
  POINT_INTERMEDIAIRE: "Point intermédiaire",
  MI_SAISON: "Mi-saison",
  FIN_SAISON: "Fin de saison",
  EXCEPTIONNEL: "Exceptionnel",
  RETOUR_BLESSURE: "Retour de blessure",
  CHANGEMENT_GROUPE: "Changement de groupe",
  COMPORTEMENT: "Comportement",
  PROJET_INDIVIDUEL: "Projet individuel",
};

export const OBJECTIVE_CATEGORY_LABELS: Record<string, string> = {
  TECHNIQUE: "Technique",
  TACTIQUE: "Tactique",
  PHYSIQUE: "Physique",
  MENTAL: "Mental",
  COMPORTEMENT: "Comportement",
  AUTRE: "Autre",
};

export const OBJECTIVE_STATUS_LABELS: Record<string, string> = {
  A_TRAVAILLER: "À travailler",
  EN_PROGRESSION: "En progression",
  ACQUIS: "Acquis",
  ABANDONNE: "Abandonné",
};

export const SESSION_BLOCK_TYPE_LABELS: Record<string, string> = {
  ACCUEIL: "Accueil",
  ACTIVATION: "Activation",
  TECHNIQUE: "Technique",
  EXERCICE: "Exercice",
  SITUATION: "Situation",
  JEU: "Jeu",
  PHYSIQUE: "Physique",
  RETOUR_AU_CALME: "Retour au calme",
  AUTRE: "Autre",
};

// 8 postes (dont GB) = Foot à 8 ; 11 postes (dont GB) = Foot à 11.
export const FORMATIONS: Record<string, [number, number, string][]> = {
  "1-3-3-1": [
    [50, 88, "GB"], [22, 66, "DG"], [50, 68, "DC"], [78, 66, "DD"],
    [24, 42, "MG"], [50, 44, "MC"], [76, 42, "MD"], [50, 18, "ATT"],
  ],
  "1-3-2-2": [
    [50, 88, "GB"], [22, 66, "DG"], [50, 68, "DC"], [78, 66, "DD"],
    [34, 44, "MC"], [66, 44, "MC"], [34, 18, "ATT"], [66, 18, "ATT"],
  ],
  "1-2-3-2": [
    [50, 88, "GB"], [34, 70, "DC"], [66, 70, "DC"],
    [24, 46, "MG"], [50, 46, "MC"], [76, 46, "MD"], [34, 18, "ATT"], [66, 18, "ATT"],
  ],
  "1-4-3-3": [
    [50, 92, "GB"],
    [15, 72, "DG"], [38, 74, "DC"], [62, 74, "DC"], [85, 72, "DD"],
    [26, 48, "MG"], [50, 50, "MC"], [74, 48, "MD"],
    [22, 20, "AG"], [50, 16, "ATT"], [78, 20, "AD"],
  ],
  "1-4-4-2": [
    [50, 92, "GB"],
    [14, 72, "DG"], [38, 74, "DC"], [62, 74, "DC"], [86, 72, "DD"],
    [16, 44, "MG"], [40, 46, "MC"], [60, 46, "MC"], [84, 44, "MD"],
    [38, 16, "ATT"], [62, 16, "ATT"],
  ],
  "1-4-2-3-1": [
    [50, 92, "GB"],
    [15, 72, "DG"], [38, 74, "DC"], [62, 74, "DC"], [85, 72, "DD"],
    [38, 52, "MDC"], [62, 52, "MDC"],
    [22, 30, "MG"], [50, 26, "MOC"], [78, 30, "MD"],
    [50, 12, "ATT"],
  ],
  "1-2-4-1": [
    [50, 88, "GB"], [30, 68, "DC"], [70, 68, "DC"],
    [15, 44, "MG"], [38, 44, "MC"], [62, 44, "MC"], [85, 44, "MD"],
    [50, 18, "ATT"],
  ],
  "1-2-2-3": [
    [50, 88, "GB"], [34, 68, "DC"], [66, 68, "DC"],
    [34, 44, "MC"], [66, 44, "MC"],
    [20, 18, "AG"], [50, 14, "ATT"], [80, 18, "AD"],
  ],
  "1-3-4-3": [
    [50, 92, "GB"],
    [30, 74, "DC"], [50, 76, "DC"], [70, 74, "DC"],
    [15, 50, "MG"], [38, 52, "MC"], [62, 52, "MC"], [85, 50, "MD"],
    [22, 20, "AG"], [50, 16, "ATT"], [78, 20, "AD"],
  ],
  "1-3-5-2": [
    [50, 92, "GB"],
    [30, 74, "DC"], [50, 76, "DC"], [70, 74, "DC"],
    [12, 50, "MG"], [34, 54, "MDC"], [50, 56, "MC"], [66, 54, "MDC"], [88, 50, "MD"],
    [38, 16, "ATT"], [62, 16, "ATT"],
  ],
  "1-4-1-4-1": [
    [50, 92, "GB"],
    [15, 72, "DG"], [38, 74, "DC"], [62, 74, "DC"], [85, 72, "DD"],
    [50, 58, "MDC"],
    [20, 38, "MG"], [40, 40, "MC"], [60, 40, "MC"], [80, 38, "MD"],
    [50, 14, "ATT"],
  ],
  "1-4-4-2-losange": [
    [50, 92, "GB"],
    [15, 72, "DG"], [38, 74, "DC"], [62, 74, "DC"], [85, 72, "DD"],
    [50, 58, "MDC"],
    [22, 42, "MG"], [78, 42, "MD"],
    [50, 34, "MOC"],
    [38, 14, "ATT"], [62, 14, "ATT"],
  ],
};

export const FORMATIONS_BY_FORMAT: Record<string, string[]> = {
  "Foot à 8": ["1-3-3-1", "1-3-2-2", "1-2-3-2", "1-2-4-1", "1-2-2-3"],
  "Foot à 11": ["1-4-3-3", "1-4-4-2", "1-4-2-3-1", "1-3-4-3", "1-3-5-2", "1-4-1-4-1", "1-4-4-2-losange"],
};
