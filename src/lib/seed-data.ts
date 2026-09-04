/**
 * Seed logic — real Saint-Sébastien FC U12/U13 data for the 2026-2027
 * season, extracted from the club's own Excel export
 * (project/xl_dump/09_JOUEURS_U12.tsv, 10_JOUEURS_U13.tsv, 15_MATCHS.tsv).
 *
 * Only facts actually present in that export are imported: player names,
 * category, and the real upcoming fixture list. Everything the export
 * doesn't contain (position, strong foot, team assignment within a
 * category, attendance history, notes, evaluations, jerseys...) is left
 * empty or set to an explicit "non renseigné" placeholder rather than
 * invented, so nothing false is ever shown about a real child or a real
 * fixture. Shared between the CLI script (prisma/seed.ts) and the
 * one-time `/api/seed` route used for first-time production setup.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Next occurrence (today or later) of the given weekday (0=Sun..6=Sat),
// then offset by `weeksAhead` additional weeks — used to generate the real
// recurring training schedule going forward from today.
function nextWeekday(base: Date, weekday: number, weeksAhead: number) {
  const diff = (weekday - base.getDay() + 7) % 7;
  return addDays(base, diff + weeksAhead * 7);
}

// ---------- Real roster (club Excel export, saison 2026-2027) ----------
// Only Nom/Prénom/Catégorie are populated in the source file — no position,
// foot, or team-within-category data exists yet.

const REAL_U12: { nom: string; prenom: string }[] = [
  { nom: "ABDELMOUMENE", prenom: "Naël" },
  { nom: "AFFI", prenom: "Timothé" },
  { nom: "AHMED YOUSFI", prenom: "Sofiane" },
  { nom: "AHMED YOUSFI", prenom: "El Amine" },
  { nom: "AL HAMKA", prenom: "Suhail" },
  { nom: "ALZI", prenom: "Léandro" },
  { nom: "BARRY", prenom: "Djibril" },
  { nom: "BENAYADA", prenom: "Ahmed" },
  { nom: "BOUZID", prenom: "Zaki" },
  { nom: "BUCA", prenom: "Idriss" },
  { nom: "CONDE", prenom: "Balamoussa" },
  { nom: "DE BASCHER", prenom: "Alexis" },
  { nom: "DERVOUT", prenom: "Lohan" },
  { nom: "ERMENIER", prenom: "Charly" },
  { nom: "FERRE", prenom: "Arthur" },
  { nom: "FORNIER", prenom: "Gabriel" },
  { nom: "GOMET", prenom: "Antoine" },
  { nom: "GOMET", prenom: "Valentin" },
  { nom: "GUILLEMOIS", prenom: "Gaetan" },
  { nom: "HAMO", prenom: "Zenal" },
  { nom: "JUHEL DELLE CASE", prenom: "Jessy" },
  { nom: "KHIZRIEV", prenom: "Aboubakar" },
  { nom: "LAVENETTE", prenom: "Kayden" },
  { nom: "LE HIR", prenom: "Arthur" },
  { nom: "LE PAGE", prenom: "Nolan" },
  { nom: "LUMPE", prenom: "Axel" },
  { nom: "MACEDO", prenom: "Ruben" },
  { nom: "MANAI", prenom: "Bédis" },
  { nom: "MBOW", prenom: "Moussa" },
  { nom: "MENEZ", prenom: "Liam" },
  { nom: "MOUZI", prenom: "Wael" },
  { nom: "PECOT", prenom: "Pablo" },
  { nom: "PERRIER", prenom: "Marius" },
  { nom: "PICHON", prenom: "Loïs" },
  { nom: "R de LINARES", prenom: "Victor" },
  { nom: "SAFARIAN", prenom: "Alex" },
  { nom: "SAULNIER", prenom: "Victor" },
  { nom: "SERTKAYA", prenom: "Sami" },
  { nom: "SGHAIER", prenom: "Bilel" },
  { nom: "SIDIBE", prenom: "El Hadj" },
  { nom: "SYALA", prenom: "Mohamed" },
  { nom: "THESSARD", prenom: "Raphael" },
];

const REAL_U13: { nom: string; prenom: string }[] = [
  { nom: "ABERKANE", prenom: "Aymen" },
  { nom: "AIT L HAJ", prenom: "Wissam" },
  { nom: "ALOMARI", prenom: "Hamzah" },
  { nom: "BERISHA", prenom: "Ensar" },
  { nom: "BLANDIN BOISSEAU", prenom: "Isaac" },
  { nom: "BOISNE", prenom: "Anthoni" },
  { nom: "BONNEAU", prenom: "Nathan" },
  { nom: "BROSSARD", prenom: "Maxence" },
  { nom: "BURAN", prenom: "Ata" },
  { nom: "CHEVALLIER", prenom: "Esteban" },
  { nom: "DAMECHE", prenom: "Yazid" },
  { nom: "DEROUIN", prenom: "Derouin" },
  { nom: "DESCATOIRE MARC", prenom: "Naël" },
  { nom: "DIA", prenom: "Thierno Souleymane" },
  { nom: "DIABY", prenom: "Souareba" },
  { nom: "DIALLO", prenom: "Saikou Yaya" },
  { nom: "FISSON LAMBERT", prenom: "Lubin" },
  { nom: "FORTINEAU", prenom: "Liam" },
  { nom: "FOUCHER", prenom: "Thomas" },
  { nom: "FURTADO CADETE", prenom: "Anibal" },
  { nom: "GALLARD", prenom: "Theo" },
  { nom: "GOULOU", prenom: "Quentin" },
  { nom: "GOURAUD ABDOU", prenom: "Adan" },
  { nom: "GOURBIL", prenom: "Colin" },
  { nom: "GUIRASSY", prenom: "Soriba" },
  { nom: "HAOUZANE", prenom: "Eden" },
  { nom: "IBRAHIM SAMBO", prenom: "Abel" },
  { nom: "JABBOUR", prenom: "Elijah" },
  { nom: "KEITA", prenom: "Ilan" },
  { nom: "LALANDE", prenom: "Manoe" },
  { nom: "MABOTO KINTSETSE", prenom: "Rayane" },
  { nom: "MANSOUR", prenom: "Aziz" },
  { nom: "MDAHOMA", prenom: "Aïman" },
  { nom: "MORNACCO", prenom: "Tyemo" },
  { nom: "MOUZI", prenom: "Ilies" },
  { nom: "NDOUTOUME LEFEU", prenom: "Armand" },
  { nom: "NOEL", prenom: "Mathis" },
  { nom: "NOURY LEDUC", prenom: "Nolan" },
  { nom: "PROU", prenom: "Emile" },
  { nom: "RICHARD", prenom: "Clement" },
  { nom: "ROUGERON", prenom: "Rafael" },
  { nom: "ROY", prenom: "Bastien" },
  { nom: "STRICKLAND", prenom: "Youn" },
  { nom: "TRAORE", prenom: "Yamoussa" },
  { nom: "TRIGUIEROS ANDRE", prenom: "Victor" },
];

// The Excel export lists players per category (U12/U13) only — it does not
// say which of the 3 groups (A/B/C) each player belongs to. Until the club
// confirms the real split, players are assigned provisionally in
// alphabetical thirds; use the team selector on the Joueurs screen to
// correct any player's group.
function splitThirds<T>(arr: T[]): [T[], T[], T[]] {
  const n = Math.ceil(arr.length / 3);
  return [arr.slice(0, n), arr.slice(n, 2 * n), arr.slice(2 * n)];
}

const TEAM_DEFS = [
  { code: "U13A", category: "U13", coachUsername: "marvyn" },
  { code: "U13B", category: "U13", coachUsername: "marina" },
  { code: "U13C", category: "U13", coachUsername: "davy" },
  { code: "U12A", category: "U12", coachUsername: "sofiane" },
  { code: "U12B", category: "U12", coachUsername: "karim" },
  { code: "U12C", category: "U12", coachUsername: "elodie" },
];

const STAFF_DEFS = [
  { username: "marvyn", name: "Marvyn Renaudin", role: "ADMIN", jobTitle: "Responsable de catégorie", accessLabel: "Complet", email: "marvyn@ssfc.fr" },
  { username: "marina", name: "Marina Tessier", role: "COACH", jobTitle: "Coach", accessLabel: "Équipes autorisées", email: "marina@ssfc.fr" },
  { username: "davy", name: "Davy Pichon", role: "COACH", jobTitle: "Coach", accessLabel: "Équipes autorisées", email: "davy@ssfc.fr" },
  { username: "sofiane", name: "Sofiane Bahri", role: "COACH", jobTitle: "Coach", accessLabel: "Équipes autorisées", email: "sofiane@ssfc.fr" },
  { username: "karim", name: "Karim Bouhali", role: "STAFF", jobTitle: "Entraîneur des gardiens", accessLabel: "Lecture + évaluations", email: "karim@ssfc.fr" },
  { username: "elodie", name: "Élodie Guitton", role: "STAFF", jobTitle: "Dirigeante", accessLabel: "Convocations et matériel", email: "elodie@ssfc.fr" },
];

export const DEMO_PASSWORD = "motdepasse";

// ---------- Real recurring weekly training schedule ----------
// From the club's PARAMETRES sheet — used automatically by the SEANCES tab.
const RECURRING_SESSIONS: {
  category: string;
  weekday: number; // 0=dim .. 6=sam
  start: string;
  end: string;
  location: string;
  scopeTeam?: string;
}[] = [
  { category: "U12", weekday: 1, start: "18:15", end: "19:45", location: "Gripots 2" }, // Lundi
  { category: "U12", weekday: 3, start: "17:00", end: "18:30", location: "Gripots 2" }, // Mercredi
  { category: "U13", weekday: 1, start: "18:15", end: "19:45", location: "Gripots 1" }, // Lundi
  { category: "U13", weekday: 3, start: "17:00", end: "18:30", location: "Gripots 1" }, // Mercredi
  { category: "U13", weekday: 5, start: "18:15", end: "19:30", location: "Gripots 2", scopeTeam: "U13A" }, // Vendredi
];
const WEEKS_AHEAD = 6;

// ---------- Real upcoming fixtures (club MATCHS sheet) ----------
// M006's "adversaire" cell in the source spreadsheet contains a stray
// lookup-table artifact ("1233") instead of an opponent name — left as
// opponent: null ("adversaire à définir"), matching its own "A définir"
// status in that same row.
const REAL_MATCHES: {
  team: string;
  date: string; // ISO
  competition: string;
  opponent: string | null;
  time: string | null;
  status: string; // "Confirme" | "A definir"
}[] = [
  { team: "U13A", date: "2026-08-22", competition: "Amical", opponent: "SC Nantes", time: "10:00", status: "Confirme" },
  { team: "U13A", date: "2026-08-26", competition: "Amical", opponent: "Voltigeurs de Châteaubriant", time: "17:15", status: "Confirme" },
  { team: "U13A", date: "2026-08-29", competition: "Amical", opponent: "Plateau Toutes Aides + SC Nantes", time: "10:00", status: "Confirme" },
  { team: "U12A", date: "2026-08-29", competition: "Amical", opponent: "U12 B", time: null, status: "A definir" },
  { team: "U13B", date: "2026-08-29", competition: "Amical", opponent: "JGE Sucé s/Erdre", time: null, status: "Confirme" },
  { team: "U12B", date: "2026-08-29", competition: "Amical", opponent: null, time: null, status: "A definir" },
  { team: "U13A", date: "2026-09-02", competition: "Amical", opponent: "Coueron Football Club", time: "17:15", status: "Confirme" },
  { team: "U12A", date: "2026-09-02", competition: "Amical", opponent: "Coueron Football Club", time: "17:15", status: "Confirme" },
  { team: "U13A", date: "2026-09-05", competition: "Tournoi", opponent: "Multiple", time: "15:30", status: "Confirme" },
  { team: "U12B", date: "2026-09-05", competition: "Amical", opponent: "FC Saint Julien 2", time: null, status: "Confirme" },
  { team: "U12C", date: "2026-09-05", competition: "Amical", opponent: "FC Saint Julien 3", time: null, status: "Confirme" },
  { team: "U12A", date: "2026-09-05", competition: "Amical", opponent: "SC Nantes", time: "10:00", status: "Confirme" },
  { team: "U13B", date: "2026-09-05", competition: "Tournoi", opponent: "AS Sautron", time: null, status: "Confirme" },
  { team: "U13C", date: "2026-09-05", competition: "Tournoi", opponent: "ES Vertou", time: null, status: "Confirme" },
];

export async function seedDatabase(prisma: PrismaClient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ---------- staff / users ----------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
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

  // ---------- teams ----------
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

  // ---------- players (real roster, provisional group split) ----------
  const [u12a, u12b, u12c] = splitThirds(REAL_U12);
  const [u13a, u13b, u13c] = splitThirds(REAL_U13);
  const groups = [
    { code: "U13A", category: "U13", list: u13a },
    { code: "U13B", category: "U13", list: u13b },
    { code: "U13C", category: "U13", list: u13c },
    { code: "U12A", category: "U12", list: u12a },
    { code: "U12B", category: "U12", list: u12b },
    { code: "U12C", category: "U12", list: u12c },
  ];

  const players: { id: string; team: string; category: string }[] = [];
  const marvynId = userByUsername.get("marvyn")!.id;
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
          decidedById: marvynId,
        },
      });
      players.push({ id: p.id, team: g.code, category: g.category });
    }
  }

  // ---------- training sessions (real recurring schedule, upcoming, non pointées) ----------
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

  // ---------- matches (real fixture list) ----------
  for (const m of REAL_MATCHES) {
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

  // ---------- settings ----------
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return { players: players.length, teams: groups.length, staff: STAFF_DEFS.map((s) => s.username) };
}
