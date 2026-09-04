import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { listUsableTemplates } from "../../../bibliotheque/template-actions";
import { StudioClient } from "./StudioClient";

export default async function SessionStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await prisma.trainingSession.findUnique({ where: { id }, include: { scopeTeam: true } });
  if (!session || session.deletedAt) notFound();
  if (!(await canAccessSession(user, session))) notFound();

  const scopeWhere = user.role === "ADMIN" ? {} : { OR: [{ visibility: "SHARED" as const }, { createdById: user.id }] };

  const [blocks, playersCount, availabilities, favorites, recent, templates] = await Promise.all([
    prisma.sessionBlock.findMany({ where: { sessionId: id }, orderBy: { order: "asc" } }),
    prisma.player.count({
      where: session.scopeTeamId ? { teamId: session.scopeTeamId, archived: false } : { category: session.category, archived: false },
    }),
    prisma.playerAvailability.findMany({ where: { sessionId: id, type: "TRAINING" } }),
    prisma.trainingContentItem.findMany({
      where: { archived: false, ...scopeWhere, favoritedBy: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true, type: true, defaultDurationMinutes: true, minPlayers: true },
    }),
    prisma.trainingContentItem.findMany({
      where: { archived: false, ...scopeWhere, sessionBlocks: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, title: true, type: true, defaultDurationMinutes: true, minPlayers: true },
    }),
    listUsableTemplates(),
  ]);

  const available = availabilities.filter((a) => a.status === "AVAILABLE").length;
  const unavailable = availabilities.filter((a) => a.status === "UNAVAILABLE").length;
  const [sh, sm] = session.startTime.split(":").map(Number);
  const [eh, em] = session.endTime.split(":").map(Number);
  const plannedMinutes = eh * 60 + em - (sh * 60 + sm);

  return (
    <div className="max-w-[1500px] mx-auto animate-fadein">
      <Link href={`/seances/${id}`} className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Séance
      </Link>
      <div className="mb-3.5 flex items-center gap-2.5">
        <div>
          <div className="text-lg font-bold tracking-[-0.01em]">
            Session Studio — {session.scopeTeam ? session.scopeTeam.code : session.category}
          </div>
          <div className="text-muted text-[12.5px] mt-0.5">
            {session.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · {session.startTime}–{session.endTime}
          </div>
        </div>
      </div>

      <StudioClient
        sessionId={id}
        initialBlocks={blocks}
        plannedMinutes={plannedMinutes}
        effectif={{ total: playersCount, available, unavailable, noResponse: Math.max(0, playersCount - available - unavailable) }}
        initialFavorites={favorites}
        initialRecent={recent}
        templates={templates}
      />
    </div>
  );
}
