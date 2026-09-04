import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser, scopedTeamIds } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ players: [], teams: [], matches: [], sessions: [] });

  const scope = scopedTeamIds(user);
  const teamWhere = scope === "ALL" ? {} : { teamId: { in: scope } };
  const teamIdWhere = scope === "ALL" ? {} : { id: { in: scope } };

  let allowedCategories: Set<string> | null = null;
  if (scope !== "ALL") {
    const scopedTeams = await prisma.team.findMany({ where: { id: { in: scope } }, select: { category: true } });
    allowedCategories = new Set(scopedTeams.map((t) => t.category));
  }
  // A player with no fixed team (Player.teamId null) is still in scope
  // whenever their category is.
  const playerWhere = scope === "ALL" ? {} : { category: { in: [...allowedCategories!] } };

  const [playersRaw, teams, matchesRaw, sessionsRaw] = await Promise.all([
    prisma.player.findMany({
      where: { archived: false, ...playerWhere, OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] },
      include: { team: true },
      take: 6,
    }),
    prisma.team.findMany({ where: { ...teamIdWhere, code: { contains: q, mode: "insensitive" } }, take: 6 }),
    prisma.match.findMany({
      where: { ...teamWhere, opponent: { contains: q, mode: "insensitive" } },
      include: { team: true },
      orderBy: { date: "desc" },
      take: 6,
    }),
    prisma.trainingSession.findMany({
      where: {
        deletedAt: null,
        OR: [{ label: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }],
      },
      include: { scopeTeam: true },
      orderBy: { date: "desc" },
      take: 6,
    }),
  ]);

  const sessions = sessionsRaw.filter((s) =>
    scope === "ALL" ? true : s.scopeTeamId ? scope.includes(s.scopeTeamId) : allowedCategories!.has(s.category)
  );

  return NextResponse.json({
    players: playersRaw.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}`, sub: p.category, href: `/joueurs/${p.id}` })),
    teams: teams.map((t) => ({ id: t.id, label: t.code, sub: t.category, href: `/equipes/${t.id}` })),
    matches: matchesRaw.map((m) => ({
      id: m.id,
      label: `${m.team.code} vs ${m.opponent ?? "?"}`,
      sub: new Date(m.date).toLocaleDateString("fr-FR"),
      href: `/matchs/${m.id}`,
    })),
    sessions: sessions.slice(0, 6).map((s) => ({
      id: s.id,
      label: s.label,
      sub: `${s.scopeTeam?.code ?? s.category} · ${new Date(s.date).toLocaleDateString("fr-FR")}`,
      href: `/seances/${s.id}`,
    })),
  });
}
