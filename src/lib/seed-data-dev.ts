/**
 * Anonymized development seed — entirely fictional players, staff, and
 * fixtures. Deliberately NOT derived from src/lib/seed-data.ts in any way
 * (no shared names, no shared arrays): that file holds the club's real
 * roster, including real minors' names, and must stay the only place that
 * data lives. Use this seed for local development instead, via
 * `prisma/seed-dev.ts` — never `prisma db seed` / `prisma/seed.ts`, which
 * remains wired to the real data for production onboarding.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextWeekday(base: Date, weekday: number, weeksAhead: number) {
  const diff = (weekday - base.getDay() + 7) % 7;
  return addDays(base, diff + weeksAhead * 7);
}

// ---------- Fictional roster — common French given/family names, chosen
// generically enough that no combination matches a real player. ----------

const FAKE_U12: { nom: string; prenom: string }[] = [
  { nom: "MARTIN", prenom: "Lucas" },
  { nom: "BERNARD", prenom: "Nathan" },
  { nom: "DUBOIS", prenom: "Enzo" },
  { nom: "THOMAS", prenom: "Sacha" },
  { nom: "ROBERT", prenom: "Noah" },
  { nom: "PETIT", prenom: "Tom" },
  { nom: "MOREAU", prenom: "Ethan" },
  { nom: "LAURENT", prenom: "Louis" },
  { nom: "SIMON", prenom: "Gabriel" },
  { nom: "MICHEL", prenom: "Adam" },
  { nom: "GARCIA", prenom: "Rayan" },
  { nom: "DAVID", prenom: "Timéo" },
  { nom: "BERTRAND", prenom: "Maxime" },
  { nom: "ROUX", prenom: "Aaron" },
  { nom: "VINCENT", prenom: "Hugo" },
];

const FAKE_U13: { nom: string; prenom: string }[] = [
  { nom: "FOURNIER", prenom: "Raphaël" },
  { nom: "MOREL", prenom: "Léo" },
  { nom: "GIRARD", prenom: "Mohamed" },
  { nom: "ANDRE", prenom: "Nolan" },
  { nom: "MERCIER", prenom: "Arthur" },
  { nom: "BLANC", prenom: "Yanis" },
  { nom: "GUERIN", prenom: "Malo" },
  { nom: "BOYER", prenom: "Ilan" },
  { nom: "GARNIER", prenom: "Wassim" },
  { nom: "CHEVALIER", prenom: "Axel" },
  { nom: "FRANCOIS", prenom: "Bilal" },
  { nom: "LEGRAND", prenom: "Kylian" },
  { nom: "GAUTHIER", prenom: "Amir" },
  { nom: "GARCON", prenom: "Théo" },
];

function splitThirds<T>(arr: T[]): [T[], T[], T[]] {
  const n = Math.ceil(arr.length / 3);
  return [arr.slice(0, n), arr.slice(n, 2 * n), arr.slice(2 * n)];
}

const TEAM_DEFS = [
  { code: "U13A", category: "U13", coachUsername: "dev-admin" },
  { code: "U13B", category: "U13", coachUsername: "dev-coach1" },
  { code: "U13C", category: "U13", coachUsername: "dev-coach2" },
  { code: "U12A", category: "U12", coachUsername: "dev-coach3" },
  { code: "U12B", category: "U12", coachUsername: "dev-staff1" },
  { code: "U12C", category: "U12", coachUsername: "dev-staff2" },
];

const STAFF_DEFS = [
  { username: "dev-admin", name: "Alex Dupont", role: "ADMIN", jobTitle: "Responsable de catégorie", accessLabel: "Complet", email: "dev-admin@example.test" },
  { username: "dev-coach1", name: "Camille Leroy", role: "COACH", jobTitle: "Coach", accessLabel: "Équipes autorisées", email: "dev-coach1@example.test" },
  { username: "dev-coach2", name: "Sam Girard", role: "COACH", jobTitle: "Coach", accessLabel: "Équipes autorisées", email: "dev-coach2@example.test" },
  { username: "dev-coach3", name: "Jordan Faure", role: "COACH", jobTitle: "Coach", accessLabel: "Équipes autorisées", email: "dev-coach3@example.test" },
  { username: "dev-staff1", name: "Robin Perrin", role: "STAFF", jobTitle: "Entraîneur des gardiens", accessLabel: "Lecture + évaluations", email: "dev-staff1@example.test" },
  { username: "dev-staff2", name: "Charlie Renard", role: "STAFF", jobTitle: "Dirigeant", accessLabel: "Convocations et matériel", email: "dev-staff2@example.test" },
];

export const DEV_DEMO_PASSWORD = "devpassword";

const RECURRING_SESSIONS: {
  category: string;
  weekday: number;
  start: string;
  end: string;
  location: string;
  scopeTeam?: string;
}[] = [
  { category: "U12", weekday: 1, start: "18:15", end: "19:45", location: "Terrain fictif 2" },
  { category: "U12", weekday: 3, start: "17:00", end: "18:30", location: "Terrain fictif 2" },
  { category: "U13", weekday: 1, start: "18:15", end: "19:45", location: "Terrain fictif 1" },
  { category: "U13", weekday: 3, start: "17:00", end: "18:30", location: "Terrain fictif 1" },
  { category: "U13", weekday: 5, start: "18:15", end: "19:30", location: "Terrain fictif 2", scopeTeam: "U13A" },
];
const WEEKS_AHEAD = 6;

const FAKE_MATCHES: {
  team: string;
  date: string;
  competition: string;
  opponent: string | null;
  time: string | null;
}[] = [
  { team: "U13A", date: "2026-08-22", competition: "Amical", opponent: "Club Fictif A", time: "10:00" },
  { team: "U13A", date: "2026-08-29", competition: "Amical", opponent: "Club Fictif B", time: "10:00" },
  { team: "U12A", date: "2026-08-29", competition: "Amical", opponent: "Club Fictif C", time: null },
  { team: "U13B", date: "2026-09-05", competition: "Tournoi", opponent: "Club Fictif D", time: null },
  { team: "U12B", date: "2026-09-05", competition: "Amical", opponent: "Club Fictif E", time: null },
];

export async function seedDevDatabase(prisma: PrismaClient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const passwordHash = await bcrypt.hash(DEV_DEMO_PASSWORD, 10);
  const userByUsername = new Map<string, { id: string }>();
  for (const s of STAFF_DEFS) {
    const u = await prisma.user.upsert({
      where: { username: s.username },
      update: {},
      create: {
        username: s.username,
        passwordHash,
        name: s.name,
        role: s.role,
        jobTitle: s.jobTitle,
        accessLabel: s.accessLabel,
        email: s.email,
      },
    });
    userByUsername.set(s.username, u);
  }

  const teamByCode = new Map<string, { id: string; category: string }>();
  for (const t of TEAM_DEFS) {
    const team = await prisma.team.upsert({
      where: { code: t.code },
      update: {},
      create: {
        code: t.code,
        category: t.category,
        coachId: userByUsername.get(t.coachUsername)!.id,
      },
    });
    teamByCode.set(t.code, team);
  }

  const [u12a, u12b, u12c] = splitThirds(FAKE_U12);
  const [u13a, u13b, u13c] = splitThirds(FAKE_U13);
  const groups = [
    { code: "U13A", category: "U13", list: u13a },
    { code: "U13B", category: "U13", list: u13b },
    { code: "U13C", category: "U13", list: u13c },
    { code: "U12A", category: "U12", list: u12a },
    { code: "U12B", category: "U12", list: u12b },
    { code: "U12C", category: "U12", list: u12c },
  ];

  const players: { id: string; team: string; category: string }[] = [];
  const adminId = userByUsername.get("dev-admin")!.id;
  for (const g of groups) {
    for (const person of g.list) {
      const p = await prisma.player.create({
        data: {
          firstName: person.prenom,
          lastName: person.nom,
          birthYear: g.category === "U13" ? 2014 : 2015,
          teamId: teamByCode.get(g.code)!.id,
          category: g.category,
          position: "Non renseigné",
          positionAlt: "Non renseigné",
          foot: "Non renseigné",
          status: "Actif",
          joinedLabel: "Saison 2026/2027",
        },
      });
      await prisma.teamHistoryEntry.create({
        data: {
          playerId: p.id,
          toTeamId: teamByCode.get(g.code)!.id,
          date: today,
          reason: "Arrivée au club",
          decidedById: adminId,
        },
      });
      players.push({ id: p.id, team: g.code, category: g.category });
    }
  }

  for (let week = 0; week < WEEKS_AHEAD; week++) {
    for (const r of RECURRING_SESSIONS) {
      await prisma.trainingSession.create({
        data: {
          date: nextWeekday(today, r.weekday, week),
          startTime: r.start,
          endTime: r.end,
          location: r.location,
          status: "Prévue",
          category: r.category,
          scopeTeamId: r.scopeTeam ? teamByCode.get(r.scopeTeam)!.id : null,
          label: r.scopeTeam ? `Spécifique ${r.scopeTeam}` : "Séance commune",
        },
      });
    }
  }

  for (const m of FAKE_MATCHES) {
    const teamId = teamByCode.get(m.team)!.id;
    await prisma.match.create({
      data: {
        teamId,
        opponent: m.opponent,
        competition: m.competition,
        date: new Date(`${m.date}T00:00:00`),
        time: m.time,
        meetTime: null,
        isHome: true,
        location: null,
        status: "Planifié",
        needed: m.team.startsWith("U13") ? 12 : 11,
      },
    });
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return { players: players.length, teams: groups.length, staff: STAFF_DEFS.map((s) => s.username) };
}
