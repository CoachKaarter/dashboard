import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, getAccessibleCategories } from "@/lib/authz";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { createSlot, toggleSlotActive, deleteSlot } from "./actions";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function PlanningRecurrentPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const categories = getAccessibleCategories(user).sort();
  const scope = scopedTeamIds(user);

  const [slotsAll, allTeams] = await Promise.all([
    prisma.recurringSlot.findMany({ include: { scopeTeam: true }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);
  const slots = scope === "ALL" ? slotsAll : slotsAll.filter((s) => s.scopeTeamId && scope.includes(s.scopeTeamId));
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));

  return (
    <div className="max-w-[900px] mx-auto animate-fadein">
      <Link href="/planning" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Planning
      </Link>
      <div className="text-lg font-bold tracking-[-0.01em] mb-1">Planning récurrent des entraînements</div>
      <div className="text-[12.5px] text-muted mb-3.5">
        Ce modèle génère automatiquement les séances des {6} prochaines semaines. Modifier ou annuler une séance déjà
        générée (dans l&apos;écran Séances) n&apos;affecte jamais ce modèle.
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden mb-4">
        {slots.length === 0 ? (
          <div className="px-3.5 py-4 text-[12.5px] text-muted">Aucun créneau récurrent configuré.</div>
        ) : (
          slots.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0">
              <span className="text-[12.5px] font-semibold w-20 shrink-0">{DAY_NAMES[s.weekday]}</span>
              <span className="text-[12.5px] font-mono text-ink-soft w-24 shrink-0">{s.startTime}–{s.endTime}</span>
              {s.scopeTeam ? <TeamChip code={s.scopeTeam.code} /> : <Badge tone="neutral">{s.category}</Badge>}
              <span className="text-[12.5px] font-medium">{s.label}</span>
              <span className="text-[12px] text-muted">{s.location}</span>
              <span className="flex-1" />
              {!s.active && <Badge tone="orange">Suspendu</Badge>}
              <form action={toggleSlotActive.bind(null, s.id)}>
                <button type="submit" className="h-7 px-2.5 border border-line rounded-md text-[11px] font-semibold text-ink-soft hover:border-ink">
                  {s.active ? "Suspendre" : "Réactiver"}
                </button>
              </form>
              <form action={deleteSlot.bind(null, s.id)}>
                <button type="submit" className="h-7 px-2.5 border border-line rounded-md text-[11px] font-semibold text-red hover:border-red">
                  Supprimer
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <div className="bg-surface border border-line rounded-lg p-3.5">
          <div className="text-[12.5px] font-bold mb-2.5">Nouveau créneau</div>
          <form action={createSlot} className="grid grid-cols-3 gap-2.5">
            <select name="category" required defaultValue="" className={inputClass}>
              <option value="" disabled>Catégorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="scopeTeamId" defaultValue="" className={inputClass}>
              <option value="">Toute la catégorie</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.code}</option>
              ))}
            </select>
            <select name="weekday" required defaultValue="" className={inputClass}>
              <option value="" disabled>Jour</option>
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <input type="time" name="startTime" required defaultValue="18:15" className={inputClass} />
            <input type="time" name="endTime" required defaultValue="19:45" className={inputClass} />
            <input name="location" required placeholder="Terrain" className={inputClass} />
            <input name="label" placeholder="Séance commune" className={`${inputClass} col-span-2`} />
            <button type="submit" className="h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Ajouter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
