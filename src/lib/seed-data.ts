/**
 * Seed logic — realistic French U12/U13 football club demo data.
 * Deterministic (fixed RNG seed) so re-seeding an empty database reproduces
 * the same dataset. Shared between the CLI script (prisma/seed.ts) and the
 * one-time `/api/seed` route used for first-time production setup.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

let seed = 20262027;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function int(a: number, b: number) {
  return a + Math.floor(rnd() * (b - a + 1));
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}
function nextSaturday(base: Date) {
  const d = new Date(base);
  const diff = (6 - d.getDay() + 7) % 7;
  return addDays(d, diff === 0 ? 0 : diff);
}

const PRENOMS = [
  "Rayane", "Isaac", "Arthur", "Clément", "Ilies", "Soriba", "Malo", "Ethan", "Naël", "Yanis",
  "Timéo", "Marius", "Adam", "Noah", "Sacha", "Enzo", "Gabin", "Amine", "Théo", "Jules",
  "Aaron", "Mattéo", "Ibrahim", "Louka", "Nolan", "Tiago", "Élio", "Maxence", "Wassim", "Djibril",
  "Baptiste", "Younes", "Robin", "Léandre", "Anass", "Milan", "Ruben", "Nathan", "Samy", "Eliott",
  "Idriss", "Corentin", "Swann", "Océan", "Kaïs", "Ayoub", "Lenny",
];
const NOMS = [
  "Berthier", "Cauchy", "Lemoine", "Traoré", "Guillard", "Ferreira", "Bonneau", "Rousselle", "Camara", "Perrichon",
  "Vasseur", "Hamon", "Diaby", "Moriceau", "Barré", "Cissé", "Guérin", "Pichon", "Tessier", "Marchand",
  "Nguyen", "Bouhali", "Renaudin", "Lecomte", "Sylla", "Chevalier", "Aubry", "Da Silva", "Merlet", "Bricaud",
  "Kaba", "Ollivier", "Fresneau", "Loiseau", "Terrien", "Bahri", "Jouanneau", "Grégoire", "Mendy", "Ravaud",
  "Coulibaly", "Blandin", "Pasquier", "Rialland", "Douaud", "Ndiaye", "Halgand", "Guitton",
];
const POSTES = [
  "Gardien", "Défenseur central", "Latéral", "Milieu défensif", "Milieu relayeur",
  "Milieu offensif", "Ailier", "Attaquant", "Polyvalent",
];

const TEAM_DEFS = [
  { code: "U13A", category: "U13", n: 9, coachUsername: "marvyn" },
  { code: "U13B", category: "U13", n: 8, coachUsername: "marina" },
  { code: "U13C", category: "U13", n: 8, coachUsername: "davy" },
  { code: "U12A", category: "U12", n: 8, coachUsername: "sofiane" },
  { code: "U12B", category: "U12", n: 8, coachUsername: "karim" },
  { code: "U12C", category: "U12", n: 7, coachUsername: "elodie" },
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

export async function seedDatabase(prisma: PrismaClient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matchDay = nextSaturday(today);

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

  // ---------- players ----------
  type SeedPlayer = {
    id: string;
    idx: number;
    team: string;
    category: string;
    status: string;
    prenom: string;
  };
  const players: SeedPlayer[] = [];
  let idx = 0;
  for (const t of TEAM_DEFS) {
    for (let i = 0; i < t.n; i++) {
      const prenom = PRENOMS[(idx * 7 + 3) % PRENOMS.length];
      const nom = NOMS[(idx * 11 + 5) % NOMS.length];
      const poste = POSTES[(idx * 5 + 2) % POSTES.length];
      const posteAlt = POSTES[(idx * 3 + 6) % POSTES.length];
      const foot = idx % 4 === 0 ? "Gauche" : idx % 9 === 3 ? "Les deux" : "Droit";
      const status = idx % 17 === 4 ? "Blessé" : idx % 23 === 7 ? "Malade" : "Actif";
      const birthYear = t.category === "U13" ? 2014 : 2015;
      const joinedLabel = "Août " + (2020 + (idx % 5));

      const p = await prisma.player.create({
        data: {
          firstName: prenom,
          lastName: nom.toUpperCase(),
          birthYear,
          teamId: teamByCode.get(t.code)!.id,
          position: poste,
          positionAlt: poste === posteAlt ? POSTES[(idx + 2) % POSTES.length] : posteAlt,
          foot,
          status,
          joinedLabel,
        },
      });
      players.push({ id: p.id, idx, team: t.code, category: t.category, status, prenom });

      await prisma.teamHistoryEntry.create({
        data: {
          playerId: p.id,
          toTeamId: teamByCode.get(t.code)!.id,
          date: new Date(`${2020 + (idx % 5)}-08-15`),
          reason: "Arrivée au club",
          decidedById: userByUsername.get("marvyn")!.id,
        },
      });
      idx++;
    }
  }

  // A few realistic group changes (U13B -> U13A style progression)
  const promo = players.find((p) => p.team === "U13B");
  if (promo) {
    await prisma.teamHistoryEntry.create({
      data: {
        playerId: promo.id,
        fromTeamId: teamByCode.get("U13B")!.id,
        toTeamId: teamByCode.get("U13A")!.id,
        date: addDays(today, -8),
        reason: "Progression — renfort groupe A",
        decidedById: userByUsername.get("marvyn")!.id,
      },
    });
    await prisma.player.update({ where: { id: promo.id }, data: { teamId: teamByCode.get("U13A")!.id } });
    promo.team = "U13A";
  }

  // ---------- staff notes ----------
  const noteTargets = players.filter((_, i) => i % 8 === 1).slice(0, 6);
  const NOTE_TEXTS = [
    "Très bonne prise d'information entre les lignes. À confirmer sur le rythme d'un match complet.",
    "Retard de 15 minutes lundi, prévenu par le parent. Sans conséquence.",
    "Bonne progression défensive depuis la reprise, continue à travailler le pied faible.",
    "A besoin d'être rassuré à l'oral avant les matchs à enjeu.",
    "Très bon état d'esprit à l'entraînement, capitaine naturel du groupe.",
    "Reprise après blessure à surveiller, ne pas forcer les charges cette semaine.",
  ];
  for (let i = 0; i < noteTargets.length; i++) {
    await prisma.playerNote.create({
      data: {
        playerId: noteTargets[i].id,
        authorId: userByUsername.get("marvyn")!.id,
        text: NOTE_TEXTS[i % NOTE_TEXTS.length],
        createdAt: addDays(today, -int(1, 20)),
      },
    });
  }

  // ---------- training sessions + attendance ----------
  const TERRAIN_BY_CAT: Record<string, string> = { U12: "Gripots 2", U13: "Gripots 1" };
  const sessionDefs: {
    offset: number;
    category: string;
    scopeTeam?: string;
    label: string;
    start: string;
    end: string;
    location: string;
    status: string;
    pointed: boolean;
  }[] = [];
  // three past weeks, Monday + Wednesday, per category
  const pastMondays = [-17, -10, -3];
  const pastWednesdays = [-19, -12, -5];
  for (const cat of ["U12", "U13"]) {
    pastMondays.forEach((o, i) =>
      sessionDefs.push({
        offset: o, category: cat, label: "Séance commune", start: "18:15", end: "19:45",
        location: TERRAIN_BY_CAT[cat], status: "Réalisée", pointed: i > 0,
      })
    );
    pastWednesdays.forEach((o) =>
      sessionDefs.push({
        offset: o, category: cat, label: "Technique", start: "17:00", end: "18:30",
        location: "Profondine", status: "Réalisée", pointed: true,
      })
    );
    // upcoming
    [2, 9].forEach((o) =>
      sessionDefs.push({
        offset: o, category: cat, label: "Séance commune", start: "18:15", end: "19:45",
        location: TERRAIN_BY_CAT[cat], status: "Prévue", pointed: false,
      })
    );
  }
  sessionDefs.push({
    offset: 4, category: "U13", scopeTeam: "U13A", label: "Spécifique U13A",
    start: "18:15", end: "19:30", location: "Gripots 2", status: "Prévue", pointed: false,
  });

  for (const sd of sessionDefs) {
    const session = await prisma.trainingSession.create({
      data: {
        date: addDays(today, sd.offset),
        startTime: sd.start,
        endTime: sd.end,
        location: sd.location,
        status: sd.status,
        category: sd.category,
        scopeTeamId: sd.scopeTeam ? teamByCode.get(sd.scopeTeam)!.id : null,
        label: sd.label,
      },
    });
    if (!sd.pointed) continue;
    const scope = players.filter((p) =>
      sd.scopeTeam ? p.team === sd.scopeTeam : p.category === sd.category
    );
    for (const p of scope) {
      const r = rnd();
      let code = "P";
      if (p.status !== "Actif" && sd.offset > -6) code = "B";
      else if (r > 0.9) code = "ANJ";
      else if (r > 0.82) code = "AJ";
      else if (r > 0.74) code = "R";
      await prisma.attendance.create({
        data: { sessionId: session.id, playerId: p.id, code },
      });
    }
  }

  // ---------- matches ----------
  const UPCOMING = [
    { team: "U13A", opp: "SC Nantes", comp: "Championnat", home: true, place: "Gripots 1", time: "10:30", convoc: 12, need: 12 },
    { team: "U13B", opp: "ASB Rezé", comp: "Championnat", home: false, place: "Rezé — Ragon", time: "10:30", convoc: 9, need: 12 },
    { team: "U13C", opp: null, comp: "Championnat", home: true, place: null, time: null, convoc: 0, need: 12 },
    { team: "U12A", opp: "Vertou US", comp: "Plateau", home: true, place: "Profondine", time: "10:00", convoc: 11, need: 11 },
    { team: "U12B", opp: "Basse-Goulaine", comp: "Plateau", home: false, place: "Basse-Goulaine", time: "10:00", convoc: 11, need: 11 },
    { team: "U12C", opp: "La Haie-Fouassière", comp: "Amical", home: true, place: "Gripots 2", time: "14:00", convoc: 6, need: 11 },
  ];
  for (const m of UPCOMING) {
    const teamId = teamByCode.get(m.team)!.id;
    const match = await prisma.match.create({
      data: {
        teamId,
        opponent: m.opp,
        competition: m.comp,
        date: matchDay,
        time: m.time,
        meetTime: m.time ? "09:30" : null,
        isHome: m.home,
        location: m.place,
        status: "Planifié",
        needed: m.need,
      },
    });
    const squad = players.filter((p) => p.team === m.team && p.status === "Actif").slice(0, m.convoc);
    for (const p of squad) {
      await prisma.matchConvocation.create({ data: { matchId: match.id, playerId: p.id } });
    }
  }

  const PLAYED = [
    { team: "U13A", opp: "SC Nantes", comp: "Championnat", home: true, lieu: "Gripots 1", offset: -7, pour: 3, contre: 1 },
    { team: "U13B", opp: "ASB Rezé", comp: "Championnat", home: false, lieu: "Rezé — Ragon", offset: -7, pour: 1, contre: 1 },
    { team: "U13C", opp: "Vertou US", comp: "Championnat", home: true, lieu: "Gripots 2", offset: -7, pour: 0, contre: 4 },
    { team: "U13A", opp: "Voltigeurs Châteaubriant", comp: "Amical", home: false, lieu: "Châteaubriant", offset: -14, pour: 2, contre: 2 },
    { team: "U12A", opp: "Basse-Goulaine", comp: "Plateau", home: true, lieu: "Profondine", offset: -14, pour: 4, contre: 2 },
    { team: "U12B", opp: "La Haie-Fouassière", comp: "Plateau", home: false, lieu: "La Haie-Fouassière", offset: -14, pour: 1, contre: 3 },
  ];
  for (const m of PLAYED) {
    const teamId = teamByCode.get(m.team)!.id;
    const match = await prisma.match.create({
      data: {
        teamId,
        opponent: m.opp,
        competition: m.comp,
        date: addDays(matchDay, m.offset),
        time: "10:30",
        meetTime: "09:30",
        isHome: m.home,
        location: m.lieu,
        status: "Joué",
        needed: m.team.startsWith("U13") ? 12 : 11,
        scoreFor: m.pour,
        scoreAgainst: m.contre,
      },
    });
    const squad = players.filter((p) => p.team === m.team);
    const playing = squad.slice(0, Math.min(squad.length, 12));
    for (let i = 0; i < playing.length; i++) {
      const p = playing[i];
      const mins = i < 8 ? 50 - i * 3 : 20;
      await prisma.matchConvocation.create({ data: { matchId: match.id, playerId: p.id } });
      await prisma.matchPlayerStat.create({
        data: {
          matchId: match.id,
          playerId: p.id,
          role: i < 8 ? "Titulaire" : "Remplaçant",
          minutes: mins,
          goals: i === 1 ? 1 : i === 4 ? 1 : 0,
          assists: i === 2 ? 1 : 0,
          note: Math.round((2.8 + (i % 5) * 0.4) * 10) / 10,
        },
      });
    }
  }

  // ---------- evaluations (Juin = baseline, Septembre = current) ----------
  for (const p of players) {
    const base = Math.round((2.4 + rnd() * 2.2) * 10) / 10;
    const prev = Math.round((2.2 + rnd() * 2.2) * 10) / 10;
    const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v * 10) / 10));
    await prisma.evaluationScore.upsert({
      where: { playerId_period: { playerId: p.id, period: "Juin" } },
      update: {},
      create: {
        playerId: p.id, period: "Juin",
        technique: clamp(prev), tactique: clamp(prev + 0.2), physique: clamp(prev - 0.3), comportement: clamp(prev + 0.4),
        evaluatorId: userByUsername.get("marvyn")!.id,
        createdAt: addDays(today, -70),
      },
    });
    const stale = p.idx % 11 === 0; // a few players not yet evaluated this period
    if (!stale) {
      await prisma.evaluationScore.upsert({
        where: { playerId_period: { playerId: p.id, period: "Septembre" } },
        update: {},
        create: {
          playerId: p.id, period: "Septembre",
          technique: clamp(base), tactique: clamp(base + 0.3), physique: clamp(base - 0.4), comportement: clamp(base + 0.6),
          evaluatorId: userByUsername.get("marvyn")!.id,
          createdAt: addDays(today, -int(2, 18)),
        },
      });
    }
  }

  // ---------- jerseys / matériel ----------
  const JERSEYS = [
    { code: "SAC012", team: "U13A", resp: "Famille Berthier", issued: -7, due: -3, ret: null, etat: "À laver" },
    { code: "SAC013", team: "U13B", resp: "Famille Camara", issued: -7, due: -3, ret: null, etat: "À laver" },
    { code: "SAC014", team: "U13C", resp: "Famille Guérin", issued: -7, due: -3, ret: -4, etat: "Bon" },
    { code: "SAC015", team: "U12A", resp: "Famille Vasseur", issued: -14, due: -11, ret: -12, etat: "Abîmé" },
    { code: "SAC016", team: "U12B", resp: "Famille Diaby", issued: -14, due: -11, ret: -11, etat: "Bon" },
  ];
  for (const j of JERSEYS) {
    const squad = players.filter((p) => p.team === j.team);
    await prisma.jersey.upsert({
      where: { code: j.code },
      update: {},
      create: {
        code: j.code,
        teamId: teamByCode.get(j.team)!.id,
        playerId: squad.length ? squad[0].id : null,
        responsible: j.resp,
        issuedDate: addDays(today, j.issued),
        dueDate: addDays(today, j.due),
        returnedDate: j.ret !== null ? addDays(today, j.ret) : null,
        condition: j.etat,
      },
    });
  }

  // ---------- calendar events ----------
  await prisma.calendarEvent.create({
    data: {
      title: "Réunion staff", kind: "reunion", date: addDays(matchDay, -2),
      startTime: "19:00", endTime: "20:00", location: "Club-house", teamLabel: "Toutes",
    },
  });
  await prisma.calendarEvent.create({
    data: {
      title: "Tournoi U12 — Vertou", kind: "tournoi", date: addDays(matchDay, 14),
      startTime: "09:00", endTime: "17:00", location: "Vertou", teamLabel: "U12",
    },
  });
  await prisma.calendarEvent.create({
    data: {
      title: "Réunion parents", kind: "reunion", date: addDays(matchDay, 19),
      startTime: "18:30", endTime: "19:30", location: "Club-house", teamLabel: "Toutes",
    },
  });

  // ---------- settings ----------
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return { players: players.length, teams: TEAM_DEFS.length, staff: STAFF_DEFS.map((s) => s.username) };
}
