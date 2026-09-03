"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateLong } from "@/lib/format";
import { assignPlayerToTeam, unassignPlayer, assignMatchStaff, removeMatchStaff } from "@/app/(app)/week-end/actions";

type BoardPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  positionAlt: string;
  foot: string;
  teamCode: string;
};
type TeamCard = {
  team: { id: string; code: string; category: string };
  match: { id: string; opponent: string | null; time: string | null; isHome: boolean; location: string | null } | null;
  // Le vrai prochain match de l'équipe — peut être différent de `match`
  // ci-dessus (celui de CE samedi) : un match de semaine avant le week-end
  // passe en premier. null quand `match` est déjà le prochain match, pour
  // éviter d'afficher deux fois la même info.
  nextMatch: { id: string; opponent: string | null; date: string; time: string | null; isHome: boolean } | null;
  assigned: { player: BoardPlayer }[];
  keeper: { player: BoardPlayer } | null;
  staff: { id: string; role: string; user: { name: string } }[];
  needed: number;
  canManageCategory: boolean;
};

const STAFF_ROLES = ["Coach", "Adjoint", "Dirigeant", "Entraîneur gardien", "Vidéo", "Autre"];

export function WeekendBoard({
  weekStartIso,
  teamCards,
  unassigned,
  staffUsers,
  editable,
}: {
  weekStartIso: string;
  teamCards: TeamCard[];
  unassigned: BoardPlayer[];
  staffUsers: { id: string; name: string }[];
  editable: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refresh() {
    startTransition(() => router.refresh());
  }
  function drop(teamId: string) {
    if (!dragging) return;
    assignPlayerToTeam(weekStartIso, dragging, teamId).then(refresh);
    setDragging(null);
    setDragOverTeamId(null);
  }

  const rows = [teamCards.slice(0, 3), teamCards.slice(3, 6)];

  return (
    <div className="flex flex-col gap-4">
      {rows.map(
        (row, i) =>
          row.length > 0 && (
            <div key={i} className="grid grid-cols-3 gap-3.5">
              {row.map((c) => {
                const count = c.assigned.length;
                const tone = count === c.needed ? "green" : count > c.needed ? "blue" : count >= c.needed - 1 ? "orange" : "red";
                const toneColor = { green: "#3F8F5B", blue: "#3C6E9F", orange: "#C97A17", red: "#C4362C" }[tone];
                const isDropTarget = editable && dragOverTeamId === c.team.id && dragging;
                return (
                  <div
                    key={c.team.id}
                    onDragEnter={(e) => {
                      if (!editable) return;
                      e.preventDefault();
                      setDragOverTeamId(c.team.id);
                    }}
                    onDragOver={(e) => editable && e.preventDefault()}
                    onDragLeave={() => editable && setDragOverTeamId((id) => (id === c.team.id ? null : id))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (editable) drop(c.team.id);
                    }}
                    className={`bg-surface border rounded-lg overflow-hidden transition-all duration-150 ${
                      isDropTarget ? "border-blue bg-blue-bg/40 scale-[1.01] shadow-md" : "border-line"
                    }`}
                    style={{ borderTop: `3px solid ${toneColor}`, transitionProperty: "border-color, background-color, transform, box-shadow" }}
                  >
                    <div className="px-3.5 py-2.5 border-b border-line-soft">
                      <div className="flex items-center gap-2">
                        <TeamChip code={c.team.code} />
                        <span className="font-mono text-[13px] font-bold transition-colors duration-300" style={{ color: toneColor }}>
                          {count} / {c.needed}
                        </span>
                        <span className="flex-1" />
                        {c.match ? (
                          <Link href={`/matchs/${c.match.id}`} className="text-[11px] text-blue hover:underline">
                            Voir le match
                          </Link>
                        ) : (
                          c.canManageCategory && (
                            <Link href="/matchs" className="text-[11px] text-blue hover:underline">
                              Créer un match
                            </Link>
                          )
                        )}
                      </div>
                      <div className="text-[12px] text-muted mt-1">
                        {c.match ? (
                          <>
                            vs {c.match.opponent ?? "adversaire à définir"}
                            {c.match.time ? ` · ${c.match.time}` : ""} · {c.match.isHome ? "domicile" : "extérieur"}
                          </>
                        ) : (
                          <span className="text-orange">⚠ Aucun match renseigné</span>
                        )}
                      </div>
                      {c.nextMatch && (
                        <div className="text-[11px] text-blue mt-0.5">
                          Prochain match : vs {c.nextMatch.opponent ?? "adversaire à définir"} · {formatDateLong(new Date(c.nextMatch.date))}
                          {c.nextMatch.time ? ` · ${c.nextMatch.time}` : ""}
                        </div>
                      )}
                      <div className="text-[11.5px] mt-1">
                        {c.keeper ? (
                          <span>🧤 {c.keeper.player.firstName} {c.keeper.player.lastName}</span>
                        ) : (
                          <span className="text-red">🔴 Aucun gardien affecté</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted mt-1 flex flex-wrap items-center gap-1">
                        {c.staff.length === 0 && <span className="text-orange">⚠ Aucun encadrant affecté</span>}
                        {c.staff.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 bg-[#F1F1EE] rounded px-1.5 py-0.5">
                            {s.role} : {s.user.name}
                            {editable && (
                              <button
                                type="button"
                                onClick={() => removeMatchStaff(s.id).then(refresh)}
                                className="text-muted-2 hover:text-red"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {editable && c.match && (
                        <form
                          action={(fd) => assignMatchStaff(c.match!.id, fd).then(refresh)}
                          className="flex items-center gap-1 mt-1"
                        >
                          <select name="userId" defaultValue="" className="h-6 text-[10.5px] border border-line rounded bg-surface flex-1 min-w-0">
                            <option value="" disabled>Encadrant…</option>
                            {staffUsers.map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <select name="role" defaultValue="Coach" className="h-6 text-[10.5px] border border-line rounded bg-surface">
                            {STAFF_ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="h-6 px-2 text-[10.5px] border border-line rounded hover:border-ink active:scale-90 transition-all duration-100"
                          >
                            +
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="min-h-[80px]">
                      {c.assigned.map((a) => (
                        <div
                          key={a.player.id}
                          draggable={editable}
                          onDragStart={(e) => {
                            setDragging(a.player.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDragOverTeamId(null);
                          }}
                          className={`flex items-center gap-2 px-3.5 py-1.5 border-b border-line-soft-2 last:border-b-0 animate-fadein transition-all duration-150 ${
                            editable ? "cursor-grab" : ""
                          } ${dragging === a.player.id ? "opacity-40 scale-[1.02] shadow-md bg-surface" : ""}`}
                        >
                          <Avatar initials={`${a.player.firstName[0]}${a.player.lastName[0]}`} size={22} />
                          <span className="text-[12px] font-semibold flex-1 truncate">
                            {a.player.firstName} {a.player.lastName}
                          </span>
                          {editable && (
                            <form action={unassignPlayer.bind(null, weekStartIso, a.player.id)}>
                              <button
                                type="submit"
                                className="text-muted-2 hover:text-red text-[13px] px-1 transition-all duration-100 active:scale-75"
                              >
                                ×
                              </button>
                            </form>
                          )}
                        </div>
                      ))}
                      {c.assigned.length === 0 && <div className="px-3.5 py-3 text-[11.5px] text-muted-2">Glisser un joueur ici.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
      )}

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-line-soft">
          <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">
            Joueurs disponibles non affectés
          </span>
          <span className="font-mono text-[11px] text-muted-2 ml-2">{unassigned.length}</span>
        </div>
        <div className="flex flex-wrap gap-2 p-3.5">
          {unassigned.map((p) => (
            <div
              key={p.id}
              draggable={editable}
              onDragStart={(e) => {
                setDragging(p.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragging(null);
                setDragOverTeamId(null);
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 border border-line rounded-md bg-[#FAFAF8] animate-fadein transition-all duration-150 ${
                editable ? "cursor-grab" : ""
              } ${dragging === p.id ? "opacity-40 scale-[1.02] shadow-md" : ""}`}
            >
              <Avatar initials={`${p.firstName[0]}${p.lastName[0]}`} size={22} />
              <div>
                <div className="text-[12px] font-semibold">{p.firstName} {p.lastName}</div>
                <div className="text-[10.5px] text-muted-2">{p.teamCode} · {p.position}</div>
              </div>
              {editable && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) assignPlayerToTeam(weekStartIso, p.id, e.target.value).then(refresh);
                  }}
                  className="ml-1 h-6 text-[10.5px] border border-line rounded bg-surface"
                >
                  <option value="" disabled>Affecter à…</option>
                  {teamCards.map((c) => (
                    <option key={c.team.id} value={c.team.id}>{c.team.code}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          {unassigned.length === 0 && <div className="text-[12.5px] text-muted-2 py-1">Aucun joueur disponible non affecté.</div>}
        </div>
      </div>
    </div>
  );
}
