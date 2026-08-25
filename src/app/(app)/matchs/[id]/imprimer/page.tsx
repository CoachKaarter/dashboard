import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { formatDateFull, formationLabel } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { computeBench } from "@/lib/composition-pool";
import { OBJECTIVE_STATUS_LABELS, type ObjectiveStatus } from "@/lib/match-validation";

type Row = { id: string; player: { firstName: string; lastName: string; position: string }; position?: string | null; minutes: number; goals: number; assists: number; note: number | null };

export default async function FeuilleImprimablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      team: true,
      stats: { include: { player: true } },
      slots: { include: { player: true }, orderBy: { slotIndex: "asc" } },
      convocations: { include: { player: true }, orderBy: { player: { lastName: "asc" } } },
    },
  });
  if (!match) notFound();
  if (!canAccessTeam(user, match.teamId)) notFound();

  const hasStats = match.stats.length > 0;
  let starters: Row[];
  let bench: Row[];

  if (hasStats) {
    const slotOrder = new Map(match.slots.map((s, i) => [s.playerId, i]));
    starters = match.stats
      .filter((s) => s.role === "Titulaire")
      .sort((a, b) => (slotOrder.get(a.playerId) ?? 99) - (slotOrder.get(b.playerId) ?? 99));
    bench = match.stats.filter((s) => s.role === "Remplaçant");
  } else {
    starters = match.slots.map((s) => ({ id: s.id, player: s.player, position: s.player.position, minutes: 0, goals: 0, assists: 0, note: null }));
    bench = computeBench(match.convocations, match.slots).map((c) => ({
      id: c.id,
      player: c.player,
      position: c.player.position,
      minutes: 0,
      goals: 0,
      assists: 0,
      note: null,
    }));
  }

  return (
    <div className="max-w-[760px] mx-auto py-8 px-4">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div style={{ fontFamily: "sans-serif", color: "#16181C" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#6E7178", fontWeight: 700 }}>
          Feuille de match — Saint-Sébastien FC
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>
          {match.team.code} vs {match.opponent ?? "Adversaire à définir"}
        </h1>
        <div style={{ fontSize: 13, color: "#3A3D43" }}>
          {formatDateFull(match.date)}
          {match.time ? ` · Coup d'envoi ${match.time}` : ""}
          {match.meetTime ? ` · RDV ${match.meetTime}${match.meetLocation ? ` (${match.meetLocation})` : ""}` : ""} ·{" "}
          {match.competition} · {match.isHome ? "Domicile" : "Extérieur"} · {match.location ?? "lieu à définir"}
        </div>
        <div style={{ fontSize: 13, color: "#3A3D43", marginTop: 2 }}>
          Système : {formationLabel(match.formation)} ({match.team.format})
        </div>
        {match.preMatchObjective && (
          <div style={{ fontSize: 12.5, marginTop: 6 }}>
            <strong>Objectif :</strong> {match.preMatchObjective}
          </div>
        )}
        {match.status === "Joué" && (
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
            Score : {match.scoreFor} – {match.scoreAgainst}
            {match.objectiveStatus && (
              <span style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 10, color: "#6E7178" }}>
                Objectif : {OBJECTIVE_STATUS_LABELS[match.objectiveStatus as ObjectiveStatus]}
              </span>
            )}
          </div>
        )}

        <FeuilleTable title="Titulaires" rows={starters} showStats={hasStats} />
        <FeuilleTable title={`Remplaçants (${bench.length})`} rows={bench} showStats={hasStats} />

        {match.collectiveNote && (
          <div style={{ marginTop: 20, fontSize: 12.5 }}>
            <strong>Bilan collectif :</strong> {match.collectiveNote}
          </div>
        )}
      </div>
    </div>
  );
}

function FeuilleTable({ title, rows, showStats }: { title: string; rows: Row[]; showStats: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 18, overflowX: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#6E7178", marginBottom: 4 }}>{title}</div>
      <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #16181C", textAlign: "left" }}>
            <th style={{ padding: "6px 4px" }}>Joueur</th>
            <th style={{ padding: "6px 4px" }}>Poste</th>
            {showStats && (
              <>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Minutes</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Buts</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Passes</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Note</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #E3E3DE" }}>
              <td style={{ padding: "6px 4px", fontWeight: 600 }}>
                {r.player.firstName} {r.player.lastName}
              </td>
              <td style={{ padding: "6px 4px" }}>{r.position ?? r.player.position}</td>
              {showStats && (
                <>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.minutes || "—"}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.goals || "—"}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.assists || "—"}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.note ?? "—"}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
