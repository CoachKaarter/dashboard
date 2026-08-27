import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, canManageCategory } from "@/lib/authz";
import { createMatch } from "../actions";
import { SURFACE_TYPES } from "@/lib/match-validation";
import { TRANSPORT_MODES, TRANSPORT_MODE_LABELS } from "@/lib/equipment";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function NouveauMatchPage({ searchParams }: { searchParams: Promise<{ teamId?: string; reprendre?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = scopedTeamIds(user);
  const allTeams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  // Creating a fixture needs Responsable-level coverage of the team's
  // category (or the ADMIN technical role) — a Coach-only team never
  // appears here, mirroring createMatch's own server-side check.
  const isAdmin = user.role === "ADMIN";
  const teams = (scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id))).filter(
    (t) => isAdmin || canManageCategory(user, t.category)
  );
  const preselectedTeamId = sp.teamId && teams.some((t) => t.id === sp.teamId) ? sp.teamId : undefined;

  const [venues, matchTemplates, lastMatch] = await Promise.all([
    prisma.venue.findMany({ orderBy: { name: "asc" } }),
    prisma.matchTemplate.findMany({ orderBy: { name: "asc" } }),
    // "Reprendre le dernier match" (§17) — uniquement les infos pratiques,
    // jamais score/composition/convocations/stats.
    sp.reprendre === "1" && preselectedTeamId
      ? prisma.match.findFirst({ where: { teamId: preselectedTeamId }, orderBy: { date: "desc" } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/matchs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les matchs
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouveau match</div>
        {teams.length === 0 ? (
          <div className="text-[12.5px] text-muted-2 py-2">
            Aucune équipe pour laquelle vous êtes Responsable de catégorie — seul un Responsable peut créer un match.
          </div>
        ) : (
        <form action={createMatch} className="flex flex-col gap-3.5">
          <Field label="Équipe">
            <select name="teamId" required defaultValue={preselectedTeamId ?? ""} className={inputClass}>
              {!preselectedTeamId && <option value="" disabled>— choisir —</option>}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          </Field>
          {!lastMatch && (
            <div className="flex flex-wrap gap-1.5 -mt-1.5">
              {teams.map((t) => (
                <Link
                  key={t.id}
                  href={`/matchs/nouveau?teamId=${t.id}&reprendre=1`}
                  className="text-[11px] px-2 py-1 rounded-md border border-line-soft text-muted-2 hover:border-ink hover:text-ink"
                >
                  ↺ Reprendre les infos du dernier match {t.code}
                </Link>
              ))}
            </div>
          )}
          {lastMatch && (
            <div className="text-[11.5px] text-green bg-[#EEF7EF] border border-[#D6ECD8] rounded-md px-2.5 py-1.5">
              Infos pratiques reprises du dernier match ({lastMatch.opponent ?? "adversaire à définir"} du {lastMatch.date.toISOString().slice(0, 10)}) —
              modifiables ci-dessous.
            </div>
          )}
          <Field label="Adversaire (optionnel)">
            <input name="opponent" placeholder="À définir" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Compétition">
              <select name="competition" defaultValue="Championnat" className={inputClass}>
                <option value="Championnat">Championnat</option>
                <option value="Amical">Amical</option>
                <option value="Tournoi">Tournoi</option>
                <option value="Coupe">Coupe</option>
                <option value="Plateau">Plateau</option>
                <option value="Autre">Autre</option>
              </select>
            </Field>
            <Field label="Joueurs requis">
              <input type="number" name="needed" defaultValue={12} min={7} max={16} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" name="date" required className={inputClass} />
            </Field>
            <Field label="Heure">
              <input type="time" name="time" className={inputClass} />
            </Field>
          </div>
          <Field label="Lieu">
            <input name="location" defaultValue={lastMatch?.location ?? ""} placeholder="Terrain" className={inputClass} />
          </Field>
          <Field label="Lieu enregistré (optionnel)">
            <select name="venueId" defaultValue={lastMatch?.venueId ?? ""} className={inputClass}>
              <option value="">— aucun / adresse libre —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Surface (optionnel)">
            <select name="surface" defaultValue={lastMatch?.surface ?? ""} className={inputClass}>
              <option value="">Surface — non précisée</option>
              {SURFACE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lieu du rendez-vous (optionnel)">
            <input name="meetLocation" defaultValue={lastMatch?.meetLocation ?? ""} placeholder="Ex. parking du club" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" name="isHome" defaultChecked={lastMatch?.isHome ?? true} className="w-4 h-4" />
            Match à domicile
          </label>

          <details className="border border-line-soft rounded-md">
            <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-muted hover:text-ink select-none">
              Infos parents (facultatif — préremplies automatiquement à la création)
            </summary>
            <div className="px-3 pb-3 flex flex-col gap-2.5">
              <Field label="Modèle de match">
                <select name="matchTemplateId" defaultValue={lastMatch?.matchTemplateId ?? ""} className={inputClass}>
                  <option value="">— sélection automatique —</option>
                  {matchTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Heure de RDV (sinon calculée)">
                  <input name="meetTime" type="time" defaultValue={lastMatch?.meetTime ?? ""} className={inputClass} />
                </Field>
                <Field label="Fin estimée (sinon calculée)">
                  <input name="estimatedEndTime" type="time" defaultValue={lastMatch?.estimatedEndTime ?? ""} className={inputClass} />
                </Field>
              </div>
              <Field label="Retour estimé (sinon calculé)">
                <input name="estimatedReturnTime" type="time" defaultValue={lastMatch?.estimatedReturnTime ?? ""} className={inputClass} />
              </Field>
              <Field label="Adresse complète du lieu">
                <input name="venueAddress" defaultValue={lastMatch?.venueAddress ?? ""} className={inputClass} />
              </Field>
              <Field label="Transport">
                <select name="transportMode" defaultValue={lastMatch?.transportMode ?? ""} className={inputClass}>
                  <option value="">— hérité de l&apos;équipe / du modèle —</option>
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tenue demandée">
                <input name="dressCode" defaultValue={lastMatch?.dressCode ?? ""} className={inputClass} />
              </Field>
              <Field label="Matériel personnel">
                <input name="personalGear" defaultValue={lastMatch?.personalGear ?? ""} className={inputClass} />
              </Field>
              <Field label="Repas / collation">
                <input name="mealInfo" defaultValue={lastMatch?.mealInfo ?? ""} className={inputClass} />
              </Field>
              <Field label="Consignes pour les parents">
                <textarea name="parentInstructions" defaultValue={lastMatch?.parentInstructions ?? ""} rows={2} className={`${inputClass} h-auto py-2 resize-y`} />
              </Field>
            </div>
          </details>

          <button
            type="submit"
            className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]"
          >
            Créer le match
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">{label}</span>
      {children}
    </label>
  );
}
