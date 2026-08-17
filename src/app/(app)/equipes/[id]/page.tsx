import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { POSITIONS } from "@/lib/constants";
import { formatDateFull } from "@/lib/format";
import { updateTeamTarget, updateTeamFormat, updateTeamCoach } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function EquipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessTeam(user, id)) notFound();

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      coach: true,
      players: { where: { archived: false }, orderBy: [{ position: "asc" }, { lastName: "asc" }] },
    },
  });
  if (!team) notFound();

  const isAdmin = user.role === "ADMIN";
  const coaches = isAdmin ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [];

  const movements = await prisma.teamHistoryEntry.findMany({
    where: { OR: [{ fromTeamId: id }, { toTeamId: id }] },
    include: { player: true, fromTeam: true, toTeam: true, decidedBy: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  const byPosition = new Map<string, typeof team.players>();
  for (const pos of [...POSITIONS, "Non renseigné"]) byPosition.set(pos, []);
  for (const p of team.players) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }

  const actual = team.players.length;
  const target = team.targetSize;

  return (
    <div className="max-w-[1100px] mx-auto animate-fadein">
      <Link href="/equipes" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Toutes les équipes
      </Link>

      <div className="bg-surface border border-line rounded-lg px-[18px] py-4 flex items-center gap-3 flex-wrap">
        <TeamChip code={team.code} />
        <div className="text-xl font-bold tracking-[-0.02em]">{team.category}</div>
        <span className="text-[13px] text-muted">
          {actual} joueur{actual > 1 ? "s" : ""}
          {target ? ` sur un effectif cible de ${target}` : ""}
        </span>
        <span className="flex-1" />
        <Link href="/joueurs/nouveau" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink flex items-center">
          + Ajouter un joueur
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3.5">
        <form action={updateTeamTarget.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Effectif cible</span>
          <div className="flex gap-2">
            <input type="number" name="targetSize" min={1} max={30} defaultValue={target ?? ""} className={`${inputClass} flex-1`} />
            <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
          </div>
        </form>
        <form action={updateTeamFormat.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Format</span>
          <div className="flex gap-2">
            <select name="format" defaultValue={team.format} className={`${inputClass} flex-1`}>
              <option value="Foot à 8">Foot à 8</option>
              <option value="Foot à 11">Foot à 11</option>
            </select>
            <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
          </div>
        </form>
        {isAdmin ? (
          <form action={updateTeamCoach.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Coach / responsable</span>
            <div className="flex gap-2">
              <select name="coachId" defaultValue={team.coachId ?? ""} className={`${inputClass} flex-1`}>
                <option value="">— non assigné —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
            </div>
          </form>
        ) : (
          <div className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Coach / responsable</span>
            <span className="text-[13px] font-medium mt-1.5">{team.coach?.name ?? "— non assigné —"}</span>
          </div>
        )}
      </div>

      <div className="text-[13px] font-bold mt-5 mb-2">Tableau de profondeur par poste</div>
      <div className="grid grid-cols-3 gap-3">
        {[...byPosition.entries()].filter(([, players]) => players.length > 0).map(([pos, players]) => (
          <div key={pos} className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-line-soft bg-[#FAFAF8] flex items-center gap-2">
              <span className="text-[12px] font-bold text-ink-soft">{pos}</span>
              <Badge tone="neutral">{players.length}</Badge>
            </div>
            {players.map((p) => (
              <Link key={p.id} href={`/joueurs/${p.id}`} className="flex items-center gap-2 px-3 py-1.5 border-b border-line-soft-2 last:border-b-0 hover:bg-[#FAFAF8]">
                <Avatar initials={`${p.firstName[0]}${p.lastName[0]}`} size={22} />
                <span className="text-[12.5px] font-medium truncate">{p.firstName} {p.lastName}</span>
                {p.status !== "Actif" && <Badge tone="orange" className="ml-auto">{p.status}</Badge>}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="text-[13px] font-bold mt-5 mb-2">Historique des mouvements</div>
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {movements.length === 0 ? (
          <div className="px-3.5 py-4 text-[12.5px] text-muted">Aucun mouvement enregistré pour cette équipe.</div>
        ) : (
          movements.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-line-soft-2 last:border-b-0 text-[12.5px]">
              <span className="text-muted-2 w-20 shrink-0">{formatDateFull(m.date)}</span>
              <Link href={`/joueurs/${m.playerId}`} className="font-semibold hover:underline">{m.player.firstName} {m.player.lastName}</Link>
              <span className="text-ink-soft">
                {m.fromTeam ? `${m.fromTeam.code} → ` : ""}{m.toTeam ? m.toTeam.code : "sorti"}
              </span>
              <span className="text-muted flex-1 truncate">{m.reason}</span>
              {m.decidedBy && <span className="text-muted-2 text-[11px]">par {m.decidedBy.name}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
