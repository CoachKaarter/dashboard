import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { TeamChip } from "@/components/ui/TeamChip";
import { formatDateShort } from "@/lib/format";

const CUTOFF_DAYS = 10;

export default async function WellnessPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CUTOFF_DAYS);

  const feedbackAll = await prisma.sessionFeedback.findMany({
    where: { OR: [{ preAnsweredAt: { gte: cutoff } }, { postAnsweredAt: { gte: cutoff } }] },
    include: { player: { include: { team: true } }, session: true },
    orderBy: { postAnsweredAt: "desc" },
  });
  const feedback = scope === "ALL" ? feedbackAll : feedbackAll.filter((f) => scope.includes(f.player.teamId));

  const pain = feedback.filter((f) => f.pain);
  const highRpe = feedback.filter((f) => f.rpe && f.rpe >= 8);
  const highFatigue = feedback.filter((f) => f.fatigue === "Beaucoup");

  // Séances récentes sans aucun retour du joueur.
  const recentSessionsAll = await prisma.trainingSession.findMany({
    where: { status: "Réalisée", date: { gte: cutoff } },
    include: { scopeTeam: true, sessionFeedback: true },
    orderBy: { date: "desc" },
  });
  let allowedCategories: Set<string> | null = null;
  if (scope !== "ALL") {
    const teams = await prisma.team.findMany({ where: { id: { in: scope } } });
    allowedCategories = new Set(teams.map((t) => t.category));
  }
  const recentSessions = recentSessionsAll.filter((s) =>
    scope === "ALL" ? true : s.scopeTeamId ? scope.includes(s.scopeTeamId) : allowedCategories!.has(s.category)
  );
  const unfilledCount = recentSessions.reduce((n, s) => n + (s.sessionFeedback.length === 0 ? 1 : 0), 0);

  return (
    <div className="max-w-[900px] mx-auto animate-fadein">
      <div className="text-lg font-bold tracking-[-0.01em] mb-1">Wellness — ressenti des joueurs</div>
      <div className="text-[12.5px] text-muted mb-4">
        Indicateur de tendance à partir des questionnaires pré/post-séance — ce n&apos;est pas une mesure médicale.
      </div>

      <Section title="Douleurs signalées" empty="Aucune douleur signalée récemment.">
        {pain.map((f) => (
          <Row key={f.id} tone="red" icon="🔴" player={f.player} detail={f.painLocation ? `Douleur signalée : ${f.painLocation}` : "Douleur signalée"} date={f.preAnsweredAt} />
        ))}
      </Section>

      <Section title="Difficulté perçue élevée (RPE ≥ 8)" empty="Aucun RPE élevé récemment.">
        {highRpe.map((f) => (
          <Row key={f.id} tone="orange" icon="🟠" player={f.player} detail={`RPE ${f.rpe}/10 — ${formatDateShort(f.session.date)}`} date={f.postAnsweredAt} />
        ))}
      </Section>

      <Section title="Fatigue élevée" empty="Rien à signaler.">
        {highFatigue.map((f) => (
          <Row key={f.id} tone="orange" icon="⚠" player={f.player} detail="Fatigue : Beaucoup" date={f.preAnsweredAt} />
        ))}
      </Section>

      <div className="bg-surface border border-line rounded-lg px-3.5 py-3 text-[12.5px] text-muted">
        {unfilledCount} séance{unfilledCount > 1 ? "s" : ""} récente{unfilledCount > 1 ? "s" : ""} sans aucun questionnaire renseigné par les joueurs.
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some((c) => c);
  return (
    <div className="bg-surface border border-line rounded-lg overflow-hidden mb-3.5">
      <div className="px-3.5 py-2.5 border-b border-line-soft bg-[#FAFAF8] text-[11px] font-bold tracking-[0.08em] uppercase text-muted">{title}</div>
      {hasItems ? <div>{children}</div> : <div className="px-3.5 py-3 text-[12.5px] text-muted-2">{empty}</div>}
    </div>
  );
}

function Row({
  tone,
  icon,
  player,
  detail,
  date,
}: {
  tone: "red" | "orange";
  icon: string;
  player: { id: string; firstName: string; lastName: string; team: { category: string } };
  detail: string;
  date: Date | null;
}) {
  return (
    <Link
      href={`/joueurs/${player.id}`}
      className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0 hover:bg-[#FAFAF8]"
    >
      <span>{icon}</span>
      <TeamChip code={player.team.category} />
      <span className="text-[12.5px] font-semibold">{player.firstName} {player.lastName}</span>
      <span className={`text-[12px] ${tone === "red" ? "text-red" : "text-orange"}`}>{detail}</span>
      <span className="flex-1" />
      {date && <span className="text-[11px] text-muted-2">{formatDateShort(date)}</span>}
    </Link>
  );
}
