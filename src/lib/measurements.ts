import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const DEFAULT_TEST_TYPES = [
  { name: "Poids", unit: "kg", lowerIsBetter: false, order: 0 },
  { name: "Taille", unit: "cm", lowerIsBetter: false, order: 1 },
  { name: "Vitesse 20m", unit: "s", lowerIsBetter: true, order: 2 },
  { name: "Détente", unit: "cm", lowerIsBetter: false, order: 3 },
  { name: "Endurance (VMA)", unit: "km/h", lowerIsBetter: false, order: 4 },
  { name: "Jonglerie pied droit", unit: "touches", lowerIsBetter: false, order: 5 },
  { name: "Jonglerie pied gauche", unit: "touches", lowerIsBetter: false, order: 6 },
  { name: "Jonglerie alterné", unit: "touches", lowerIsBetter: false, order: 7 },
];

// Lazily seeds a starter catalog the first time the feature is used —
// mirrors getSettings()'s single-row lazy-create, just for several rows at
// once. Only fires when the table is completely empty, so it never fights
// back against a club that has since renamed/removed/added test types.
export const getTestTypes = cache(async () => {
  const count = await prisma.physicalTestType.count();
  if (count === 0) {
    await prisma.physicalTestType.createMany({ data: DEFAULT_TEST_TYPES });
  }
  return prisma.physicalTestType.findMany({ where: { active: true }, orderBy: { order: "asc" } });
});

export type MeasurementTableRow = {
  id: string;
  firstName: string;
  lastName: string;
  category: string;
  latest: Map<string, { value: number; date: Date }>;
};

// One row per player, each carrying only its MOST RECENT value per test
// type — the /mesures table is a snapshot of where the squad stands today,
// not a full history dump (that's what the fiche joueur panel is for).
export async function getMeasurementTable(scope: string[] | "ALL"): Promise<MeasurementTableRow[]> {
  // A player with no fixed team (Player.teamId null) is still in scope
  // whenever their category is.
  const scopeCategories =
    scope === "ALL" ? null : new Set((await prisma.team.findMany({ where: { id: { in: scope } }, select: { category: true } })).map((t) => t.category));
  const players = await prisma.player.findMany({
    where: { archived: false, ...(scopeCategories ? { category: { in: [...scopeCategories] } } : {}) },
    include: { team: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  if (players.length === 0) return [];

  const results = await prisma.physicalTestResult.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    orderBy: { date: "desc" },
  });
  const latestByPlayer = new Map<string, Map<string, { value: number; date: Date }>>();
  for (const r of results) {
    const playerMap = latestByPlayer.get(r.playerId) ?? new Map<string, { value: number; date: Date }>();
    if (!playerMap.has(r.testTypeId)) playerMap.set(r.testTypeId, { value: r.value, date: r.date });
    latestByPlayer.set(r.playerId, playerMap);
  }

  return players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    category: p.category,
    latest: latestByPlayer.get(p.id) ?? new Map(),
  }));
}

export type MeasurementTrend = "up" | "down" | "stable";

// "up" always means "improved", not "the number went up" — a sprint time
// going down IS the improvement when lowerIsBetter is true.
export function computeMeasurementTrend(current: number, previous: number, lowerIsBetter: boolean): MeasurementTrend {
  if (current === previous) return "stable";
  const improved = lowerIsBetter ? current < previous : current > previous;
  return improved ? "up" : "down";
}

export type PlayerMeasurementGroup = {
  testType: { id: string; name: string; unit: string; lowerIsBetter: boolean };
  entries: { id: string; date: Date; value: number; note: string | null }[];
};

// Full history for one player, grouped by test type, most recent entry
// first within each group — feeds the "Mesures" tab on the fiche joueur.
export async function getPlayerMeasurementHistory(playerId: string): Promise<PlayerMeasurementGroup[]> {
  const results = await prisma.physicalTestResult.findMany({
    where: { playerId },
    include: { testType: true },
    orderBy: { date: "desc" },
  });
  const byTestType = new Map<string, PlayerMeasurementGroup>();
  for (const r of results) {
    const group = byTestType.get(r.testTypeId) ?? { testType: r.testType, entries: [] };
    group.entries.push({ id: r.id, date: r.date, value: r.value, note: r.note });
    byTestType.set(r.testTypeId, group);
  }
  return [...byTestType.values()].sort((a, b) => a.testType.name.localeCompare(b.testType.name));
}
