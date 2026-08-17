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
};
