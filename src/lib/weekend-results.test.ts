import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWeekendResultLine, selectWeekendResultLines, type WeekendResultMatch } from "./weekend-results";

const base: WeekendResultMatch = {
  teamId: "team-u13a",
  teamCode: "U13A",
  status: "Joué",
  competition: "Championnat",
  opponent: "Châteaubriant",
  scoreFor: null,
  scoreAgainst: null,
  tournamentRanking: null,
  tournamentTeamsCount: null,
};

// CAS 3
test("formatWeekendResultLine: victoire", () => {
  const line = formatWeekendResultLine({ ...base, scoreFor: 4, scoreAgainst: 2 });
  assert.equal(line, "U13A — Victoire 4-2 vs Châteaubriant");
});

// CAS 4
test("formatWeekendResultLine: match nul", () => {
  const line = formatWeekendResultLine({ ...base, teamCode: "U13B", opponent: "Sucé-sur-Erdre", scoreFor: 2, scoreAgainst: 2 });
  assert.equal(line, "U13B — Match nul 2-2 vs Sucé-sur-Erdre");
});

// CAS 5
test("formatWeekendResultLine: défaite", () => {
  const line = formatWeekendResultLine({ ...base, teamCode: "U13C", opponent: "Sautron", scoreFor: 1, scoreAgainst: 3 });
  assert.equal(line, "U13C — Défaite 1-3 vs Sautron");
});

// CAS 6
test("formatWeekendResultLine: match planifié sans score est absent", () => {
  const line = formatWeekendResultLine({ ...base, status: "Planifié", scoreFor: null, scoreAgainst: null });
  assert.equal(line, null);
});

// CAS 7
test("formatWeekendResultLine: match annulé est absent même avec un score resté en mémoire", () => {
  const line = formatWeekendResultLine({ ...base, status: "Annulé", scoreFor: 3, scoreAgainst: 1 });
  assert.equal(line, null);
});

// CAS 8
test("formatWeekendResultLine: aucun résultat exploitable (pas de score, pas de tournoi)", () => {
  const line = formatWeekendResultLine({ ...base, competition: "Amical", scoreFor: null, scoreAgainst: null });
  assert.equal(line, null);
});

// CAS 10
test("formatWeekendResultLine: tournoi avec classement final exploitable", () => {
  const line = formatWeekendResultLine({
    ...base,
    competition: "Tournoi",
    opponent: "Sautron",
    scoreFor: null,
    scoreAgainst: null,
    tournamentRanking: 3,
    tournamentTeamsCount: 16,
  });
  assert.equal(line, "U13A — Tournoi de Sautron — 3e / 16 équipes");
});

test("formatWeekendResultLine: tournoi sans classement exploitable reste absent", () => {
  const line = formatWeekendResultLine({ ...base, competition: "Tournoi", scoreFor: null, scoreAgainst: null });
  assert.equal(line, null);
});

test("formatWeekendResultLine: un score final prime sur un classement de tournoi si les deux existent", () => {
  const line = formatWeekendResultLine({
    ...base,
    competition: "Tournoi",
    scoreFor: 2,
    scoreAgainst: 0,
    tournamentRanking: 1,
    tournamentTeamsCount: 8,
  });
  assert.equal(line, "U13A — Victoire 2-0 vs Châteaubriant");
});

// CAS 2
test("selectWeekendResultLines: plusieurs matchs joués apparaissent tous", () => {
  const matches: WeekendResultMatch[] = [
    { ...base, teamId: "t1", teamCode: "U13A", scoreFor: 4, scoreAgainst: 2 },
    { ...base, teamId: "t2", teamCode: "U13B", opponent: "Sucé-sur-Erdre", scoreFor: 2, scoreAgainst: 2 },
    { ...base, teamId: "t3", teamCode: "U13C", opponent: "Sautron", scoreFor: 1, scoreAgainst: 3 },
  ];
  const lines = selectWeekendResultLines(matches, ["t1", "t2", "t3"]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines, [
    "U13A — Victoire 4-2 vs Châteaubriant",
    "U13B — Match nul 2-2 vs Sucé-sur-Erdre",
    "U13C — Défaite 1-3 vs Sautron",
  ]);
});

test("selectWeekendResultLines: une équipe avec deux matchs dans la semaine (amical + championnat) donne deux lignes", () => {
  const matches: WeekendResultMatch[] = [
    { ...base, teamId: "t1", teamCode: "U13A", competition: "Amical", opponent: "Châteaubriant", scoreFor: 3, scoreAgainst: 1 },
    { ...base, teamId: "t1", teamCode: "U13A", competition: "Championnat", opponent: "Rezé", scoreFor: 2, scoreAgainst: 0 },
  ];
  const lines = selectWeekendResultLines(matches, ["t1"]);
  assert.deepEqual(lines, ["U13A — Victoire 3-1 vs Châteaubriant", "U13A — Victoire 2-0 vs Rezé"]);
});

// CAS 8
test("selectWeekendResultLines: aucun résultat exploitable renvoie une liste vide", () => {
  const matches: WeekendResultMatch[] = [
    { ...base, teamId: "t1", status: "Planifié" },
    { ...base, teamId: "t2", status: "Annulé" },
  ];
  assert.deepEqual(selectWeekendResultLines(matches, ["t1", "t2"]), []);
});

// CAS 9
test("selectWeekendResultLines: une équipe hors du périmètre autorisé n'apparaît jamais, même jouée", () => {
  const matches: WeekendResultMatch[] = [
    { ...base, teamId: "t-u13a", teamCode: "U13A", scoreFor: 4, scoreAgainst: 2 },
    { ...base, teamId: "t-u8a", teamCode: "U8A", opponent: "Rezé", scoreFor: 5, scoreAgainst: 1 },
  ];
  // Utilisateur avec accès uniquement U13 (ex. Marvyn sans U8/U9).
  const lines = selectWeekendResultLines(matches, ["t-u13a"]);
  assert.deepEqual(lines, ["U13A — Victoire 4-2 vs Châteaubriant"]);
  assert.ok(!lines.some((l) => l.includes("U8")));
});
