import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { formatDateFull } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export default async function FeuilleImprimablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      team: true,
      stats: { include: { player: true }, orderBy: [{ role: "asc" }] },
      convocations: { include: { player: true }, orderBy: { player: { lastName: "asc" } } },
    },
  });
  if (!match) notFound();
  if (!canAccessTeam(user, match.teamId)) notFound();

  const rows = match.stats.length > 0 ? match.stats : match.convocations.map((c) => ({ id: c.id, player: c.player, role: "Convoqué", minutes: 0, goals: 0, assists: 0, note: null as number | null }));

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
          {formatDateFull(match.date)}{match.time ? ` à ${match.time}` : ""} · {match.competition} ·{" "}
          {match.isHome ? "Domicile" : "Extérieur"} · {match.location ?? "lieu à définir"}
        </div>
        {match.status === "Joué" && (
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
            Score : {match.scoreFor} – {match.scoreAgainst}
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #16181C", textAlign: "left" }}>
              <th style={{ padding: "6px 4px" }}>Joueur</th>
              <th style={{ padding: "6px 4px" }}>Statut</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Minutes</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Buts</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Passes</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #E3E3DE" }}>
                <td style={{ padding: "6px 4px", fontWeight: 600 }}>{r.player.firstName} {r.player.lastName}</td>
                <td style={{ padding: "6px 4px" }}>{r.role}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.minutes || "—"}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.goals || "—"}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.assists || "—"}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{r.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {match.collectiveNote && (
          <div style={{ marginTop: 20, fontSize: 12.5 }}>
            <strong>Bilan collectif :</strong> {match.collectiveNote}
          </div>
        )}
      </div>
    </div>
  );
}
