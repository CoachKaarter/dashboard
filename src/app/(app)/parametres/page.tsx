import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getClub, getClubMessageTemplates } from "@/lib/club";
import { requireResponsableOrAdmin } from "@/lib/authz";
import { NumField } from "@/components/ui/NumField";
import { ColorField } from "@/components/ui/ColorField";
import { Badge } from "@/components/ui/Badge";
import { formatDateFull } from "@/lib/format";
import { DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, DEFAULT_CONVOCATION_MESSAGE_TEMPLATE } from "@/lib/message-templates";
import { COMPETITION_TYPES } from "@/lib/match-validation";
import { TRANSPORT_MODES, TRANSPORT_MODE_LABELS } from "@/lib/equipment";
import {
  updateSettings,
  createSeason,
  setCurrentSeason,
  updateClub,
  updateMessageTemplates,
  createVenue,
  updateVenue,
  deleteVenue,
  createMatchTemplate,
  updateMatchTemplate,
  deleteMatchTemplate,
} from "./actions";

const settingsInputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

// Réglages club (branding, seuils d'alerte, saisons, sauvegarde) restent
// ADMIN uniquement. Lieux et Modèles de match sont des réglages globaux
// mais opérationnels — un Responsable de n'importe quelle catégorie (ou
// l'École de foot) doit pouvoir les tenir à jour sans passer par l'ADMIN
// (§26) : la page reste donc accessible à tout Responsable, les sections
// proprement ADMIN se masquent simplement pour les autres.
export default async function ParametresPage() {
  const [settings, user, seasons, club, messageTemplates, venues, matchTemplates] = await Promise.all([
    getSettings(),
    requireResponsableOrAdmin(),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
    getClub(),
    getClubMessageTemplates(),
    prisma.venue.findMany({ orderBy: { name: "asc" } }),
    prisma.matchTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  const isAdmin = user.role === "ADMIN";
  const currentSeason = seasons.find((s) => s.isCurrent) ?? seasons[0] ?? null;

  const seuilRows = [
    { key: "seuilPresence", label: "Taux de présence minimum", unit: "%", hint: "en dessous : alerte assiduité" },
    { key: "absRecentes", label: "Absences récentes déclenchant une alerte", unit: "absences", hint: "sur les dernières séances" },
    { key: "seuilANJ", label: "Absences non justifiées", unit: "ANJ", hint: "alerte forte au-delà" },
    { key: "ecartTdj", label: "Écart de temps de jeu vs équipe", unit: "minutes", hint: "déclenche « à surveiller »" },
    { key: "delaiEval", label: "Délai maximum sans évaluation", unit: "jours", hint: "au-delà : évaluation manquante" },
    { key: "delaiConvoc", label: "Délai sans convocation", unit: "jours", hint: "joueur potentiellement oublié" },
    { key: "horizonMatch", label: "Horizon équipe sans match", unit: "jours", hint: "alerte si aucun match programmé" },
    { key: "delaiMaillots", label: "Délai de retour des maillots", unit: "jours", hint: "après la date du match" },
  ] as const;

  const orgRows = [
    { key: "minMinutes", label: "Minutes minimum attendues par match", unit: "minutes", hint: "repère de rotation d'effectif" },
    { key: "delaiRdv", label: "Rendez-vous avant le match", unit: "minutes", hint: "heure de convocation = coup d'envoi − ce délai" },
    { key: "periodeTdj", label: "Période de temps de jeu récent", unit: "jours", hint: "fenêtre du calcul « minutes récentes »" },
  ] as const;

  return (
    <div className="max-w-[900px] mx-auto animate-fadein flex flex-col gap-3.5">
      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Saison</div>
        {[
          [
            "Saison",
            currentSeason?.label ?? "non définie",
            currentSeason ? `du ${formatDateFull(currentSeason.startDate)} au ${formatDateFull(currentSeason.endDate)}` : "à créer ci-dessous",
          ],
          ["Club", club.shortName ? `${club.name} (${club.shortName})` : club.name, "catégorie U12 / U13"],
          ["Connecté en tant que", user.name, isAdmin ? "administrateur" : "responsable"],
        ].map(([label, value, hint]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-center px-3.5 py-[10px] border-b border-line-soft-2 last:border-b-0">
            <div>
              <div className="text-[12.5px] font-semibold">{label}</div>
              <div className="text-[11.5px] text-muted mt-px">{hint}</div>
            </div>
            <div className="h-[30px] flex items-center justify-end font-mono text-[12.5px] text-ink-soft whitespace-nowrap">{value}</div>
          </div>
        ))}
      </section>

      {isAdmin && (
      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Identité visuelle</div>
        <form action={updateClub} className="p-3.5 flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-lg border border-line bg-[#FAFAF8] flex items-center justify-center overflow-hidden shrink-0">
              {club.hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/club/logo?v=${club.logoVersion}`} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] text-muted-2 text-center px-1">Aucun logo</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted">Logo (PNG, JPEG ou WebP, 2 Mo max)</label>
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-[12px]" />
              {club.hasLogo && (
                <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <input type="checkbox" name="removeLogo" value="1" className="w-3.5 h-3.5" /> Retirer le logo actuel
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-muted">Nom du club</span>
              <input
                name="name"
                defaultValue={club.name}
                required
                className="h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] text-muted">Nom court</span>
              <input
                name="shortName"
                defaultValue={club.shortName ?? ""}
                placeholder="SSFC"
                className="h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <ColorField name="primaryColor" label="Couleur principale" defaultValue={club.primaryColor} />
            <ColorField name="secondaryColor" label="Couleur secondaire" defaultValue={club.secondaryColor} />
            <ColorField name="accentColor" label="Couleur d'accent" defaultValue={club.accentColor} />
          </div>

          <button type="submit" className="self-start h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
            Enregistrer l&apos;identité visuelle
          </button>
        </form>
      </section>
      )}

      {isAdmin && (
      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">
          Textes à copier
        </div>
        <form action={updateMessageTemplates} className="p-3.5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Ouverture des dispos — bouton Copier sur /disponibilites</span>

            <label className="flex items-start gap-2 text-[12.5px] text-ink-soft mt-1 mb-0.5">
              <input
                type="checkbox"
                name="includeWeekendResultsInAvailabilityMessage"
                defaultChecked={messageTemplates.includeWeekendResultsInAvailabilityMessage}
                className="w-4 h-4 mt-0.5"
              />
              <span>
                <span className="font-semibold text-ink">Inclure les résultats du week-end</span>
                <br />
                <span className="text-[11px] text-muted-2">
                  Ajoute automatiquement les résultats des matchs joués au message d&apos;ouverture des disponibilités.
                </span>
              </span>
            </label>

            <span className="text-[11px] text-muted-2">
              Variables : <code>{"{{date_limite}}"}</code> (date de clôture), <code>{"{{lien_parent}}"}</code> (lien espace parents),{" "}
              <code>{"{{resultats}}"}</code> (résultats des matchs joués la semaine précédente). Laisser vide pour revenir au texte par défaut.
            </span>
            <textarea
              name="availabilityMessageTemplate"
              defaultValue={messageTemplates.availabilityMessageTemplate ?? ""}
              placeholder={DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE}
              rows={9}
              className="border border-line rounded-md px-2.5 py-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg font-mono"
            />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Convocations publiées — bouton Copier sur /week-end</span>
            <span className="text-[11px] text-muted-2">
              Variables : <code>{"{{date}}"}</code> (date du week-end), <code>{"{{lien_parent}}"}</code> (lien espace parents),{" "}
              <code>{"{{lien_club}}"}</code> (site du club). Laisser vide pour revenir au texte par défaut.
            </span>
            <textarea
              name="convocationMessageTemplate"
              defaultValue={messageTemplates.convocationMessageTemplate ?? ""}
              placeholder={DEFAULT_CONVOCATION_MESSAGE_TEMPLATE}
              rows={7}
              className="border border-line rounded-md px-2.5 py-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg font-mono"
            />
          </label>
          <button type="submit" className="self-start h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
            Enregistrer les textes
          </button>
        </form>
      </section>
      )}

      {isAdmin && (
      <form action={updateSettings} className="flex flex-col gap-3.5">
        <section className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Seuils d&apos;alerte</div>
          {seuilRows.map((r) => (
            <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_104px_90px] gap-3.5 items-center px-3.5 py-[10px] border-b border-line-soft-2 last:border-b-0">
              <div>
                <div className="text-[12.5px] font-semibold">{r.label}</div>
                <div className="text-[11.5px] text-muted mt-px">{r.hint}</div>
              </div>
              <NumField name={r.key} defaultValue={settings[r.key]} />
              <div className="text-[11.5px] text-muted-2">{r.unit}</div>
            </div>
          ))}
        </section>

        <section className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Organisation</div>
          {orgRows.map((r) => (
            <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_104px_90px] gap-3.5 items-center px-3.5 py-[10px] border-b border-line-soft-2 last:border-b-0">
              <div>
                <div className="text-[12.5px] font-semibold">{r.label}</div>
                <div className="text-[11.5px] text-muted mt-px">{r.hint}</div>
              </div>
              <NumField name={r.key} defaultValue={settings[r.key]} />
              <div className="text-[11.5px] text-muted-2">{r.unit}</div>
            </div>
          ))}
        </section>
      </form>
      )}

      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Lieux enregistrés</div>
        <div className="px-3.5 pt-2.5 text-[11.5px] text-muted-2 leading-relaxed">
          Préremplit l&apos;adresse d&apos;un match en le sélectionnant sur sa fiche — jamais imposé, jamais dupliqué automatiquement.
        </div>
        {venues.length === 0 && <div className="px-3.5 py-3 text-[12.5px] text-muted">Aucun lieu enregistré.</div>}
        {venues.map((v) => (
          <details key={v.id} className="border-b border-line-soft-2 last:border-b-0">
            <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold hover:text-ink select-none flex items-center gap-2">
              {v.name}
              {v.city && <span className="text-muted font-normal">— {v.city}</span>}
            </summary>
            <div className="px-3.5 pb-3 flex flex-col gap-2.5">
              <form action={updateVenue.bind(null, v.id)} className="grid grid-cols-2 gap-2.5">
                <input name="name" defaultValue={v.name} placeholder="Nom du lieu" required className={`${settingsInputClass} col-span-2`} />
                <input name="address" defaultValue={v.address ?? ""} placeholder="Adresse" className={`${settingsInputClass} col-span-2`} />
                <input name="postalCode" defaultValue={v.postalCode ?? ""} placeholder="Code postal" className={settingsInputClass} />
                <input name="city" defaultValue={v.city ?? ""} placeholder="Ville" className={settingsInputClass} />
                <input name="meetingPoint" defaultValue={v.meetingPoint ?? ""} placeholder="Point de rendez-vous précis" className={`${settingsInputClass} col-span-2`} />
                <input name="parkingInfo" defaultValue={v.parkingInfo ?? ""} placeholder="Info parking" className={settingsInputClass} />
                <input name="accessInfo" defaultValue={v.accessInfo ?? ""} placeholder="Accès" className={settingsInputClass} />
                <input name="notes" defaultValue={v.notes ?? ""} placeholder="Notes" className={`${settingsInputClass} col-span-2`} />
                <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36] self-start">Enregistrer</button>
              </form>
              <form action={deleteVenue.bind(null, v.id)}>
                <button type="submit" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-red hover:border-red">Supprimer ce lieu</button>
              </form>
            </div>
          </details>
        ))}
        <form action={createVenue} className="px-3.5 py-3 grid grid-cols-2 gap-2.5 border-t border-line-soft">
          <input name="name" placeholder="Nom du nouveau lieu" required className={`${settingsInputClass} col-span-2`} />
          <input name="address" placeholder="Adresse" className={`${settingsInputClass} col-span-2`} />
          <input name="postalCode" placeholder="Code postal" className={settingsInputClass} />
          <input name="city" placeholder="Ville" className={settingsInputClass} />
          <button type="submit" className="col-span-2 h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36] self-start">+ Ajouter un lieu</button>
        </form>
      </section>

      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Modèles de match</div>
        <div className="px-3.5 pt-2.5 text-[11.5px] text-muted-2 leading-relaxed">
          Sélectionné automatiquement à la création d&apos;un match selon sa compétition et domicile/extérieur (toujours modifiable ensuite sur le match).
        </div>
        {matchTemplates.length === 0 && <div className="px-3.5 py-3 text-[12.5px] text-muted">Aucun modèle enregistré.</div>}
        {matchTemplates.map((t) => (
          <details key={t.id} className="border-b border-line-soft-2 last:border-b-0">
            <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold hover:text-ink select-none flex items-center gap-2">
              {t.name}
              {t.competition && (
                <span className="text-muted font-normal">
                  — {t.competition}
                  {t.isHome === true ? " · domicile" : t.isHome === false ? " · extérieur" : ""}
                </span>
              )}
            </summary>
            <div className="px-3.5 pb-3 flex flex-col gap-2.5">
              <form action={updateMatchTemplate.bind(null, t.id)} className="grid grid-cols-2 gap-2.5">
                <input name="name" defaultValue={t.name} placeholder="Nom du modèle" required className={`${settingsInputClass} col-span-2`} />
                <select name="competition" defaultValue={t.competition ?? ""} className={settingsInputClass}>
                  <option value="">Compétition — toutes</option>
                  {COMPETITION_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select name="isHome" defaultValue={t.isHome === true ? "true" : t.isHome === false ? "false" : ""} className={settingsInputClass}>
                  <option value="">Domicile/extérieur — les deux</option>
                  <option value="true">Domicile</option>
                  <option value="false">Extérieur</option>
                </select>
                <input type="number" name="meetTimeDeltaMinutes" min={0} max={240} defaultValue={t.meetTimeDeltaMinutes ?? ""} placeholder="RDV avant coup d'envoi (min)" className={settingsInputClass} />
                <input type="number" name="durationMinutes" min={0} max={240} defaultValue={t.durationMinutes ?? ""} placeholder="Durée du match (min)" className={settingsInputClass} />
                <input type="number" name="returnDelayMinutes" min={0} max={240} defaultValue={t.returnDelayMinutes ?? ""} placeholder="Délai de retour (min)" className={settingsInputClass} />
                <select name="transportMode" defaultValue={t.transportMode ?? ""} className={settingsInputClass}>
                  <option value="">Transport — non précisé</option>
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
                  ))}
                </select>
                <input name="dressCode" defaultValue={t.dressCode ?? ""} placeholder="Tenue demandée" className={settingsInputClass} />
                <input name="personalGear" defaultValue={t.personalGear ?? ""} placeholder="Matériel personnel" className={settingsInputClass} />
                <input name="mealInfo" defaultValue={t.mealInfo ?? ""} placeholder="Repas / collation" className={settingsInputClass} />
                <input name="parentInstructions" defaultValue={t.parentInstructions ?? ""} placeholder="Consignes pour les parents" className={`${settingsInputClass} col-span-2`} />
                <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36] self-start">Enregistrer</button>
              </form>
              <form action={deleteMatchTemplate.bind(null, t.id)}>
                <button type="submit" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-red hover:border-red">Supprimer ce modèle</button>
              </form>
            </div>
          </details>
        ))}
        <form action={createMatchTemplate} className="px-3.5 py-3 grid grid-cols-2 gap-2.5 border-t border-line-soft">
          <input name="name" placeholder="Nom du nouveau modèle" required className={`${settingsInputClass} col-span-2`} />
          <select name="competition" defaultValue="" className={settingsInputClass}>
            <option value="">Compétition — toutes</option>
            {COMPETITION_TYPES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="isHome" defaultValue="" className={settingsInputClass}>
            <option value="">Domicile/extérieur — les deux</option>
            <option value="true">Domicile</option>
            <option value="false">Extérieur</option>
          </select>
          <button type="submit" className="col-span-2 h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36] self-start">+ Ajouter un modèle</button>
        </form>
      </section>

      {isAdmin && (
      <>
      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Gestion des saisons</div>
        {seasons.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-3.5 py-[10px] border-b border-line-soft-2 last:border-b-0">
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold flex items-center gap-2">
                {s.label}
                {s.isCurrent && <Badge tone="green">Saison en cours</Badge>}
              </div>
              <div className="text-[11.5px] text-muted mt-px">
                {formatDateFull(s.startDate)} → {formatDateFull(s.endDate)}
              </div>
            </div>
            {!s.isCurrent && (
              <form action={setCurrentSeason.bind(null, s.id)}>
                <button type="submit" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink">
                  Définir comme saison en cours
                </button>
              </form>
            )}
          </div>
        ))}
        {seasons.length === 0 && <div className="px-3.5 py-4 text-[12.5px] text-muted">Aucune saison enregistrée.</div>}
        <form action={createSeason} className="flex items-end gap-2.5 px-3.5 py-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-[10.5px] text-muted">Label</span>
            <input name="label" required placeholder="2027/2028" className="h-8 border border-line rounded-md px-2 text-[12.5px] outline-none focus:border-blue" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] text-muted">Début</span>
            <input type="date" name="startDate" required className="h-8 border border-line rounded-md px-2 text-[12.5px] outline-none focus:border-blue" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] text-muted">Fin</span>
            <input type="date" name="endDate" required className="h-8 border border-line rounded-md px-2 text-[12.5px] outline-none focus:border-blue" />
          </label>
          <button type="submit" className="h-8 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">
            Ajouter une saison
          </button>
        </form>
        <div className="px-3.5 pb-3.5 text-[11.5px] text-muted-2 leading-relaxed">
          Les matchs, séances et évaluations ne sont pas encore cloisonnés par saison — c&apos;est une liste continue.
          Avant de clôturer une saison, exporte une sauvegarde complète ci-dessous pour en garder une trace permanente.
        </div>
      </section>

      <section className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-3.5 py-[11px] border-b border-line-soft text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Sauvegarde</div>
        <div className="px-3.5 py-3 flex items-center gap-3.5">
          <div className="flex-1 text-[12.5px] text-muted">
            Exporte toutes les données du club (joueurs, équipes, séances, matchs, évaluations…) dans un fichier JSON.
            Un complément manuel — Supabase effectue déjà des sauvegardes automatiques de la base au niveau infrastructure.
          </div>
          <a
            href="/api/export/backup"
            className="h-9 px-3.5 border border-line rounded-md bg-[#FCFCFB] text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink whitespace-nowrap"
          >
            Exporter une sauvegarde JSON
          </a>
        </div>
      </section>
      </>
      )}
    </div>
  );
}
