import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getClub, getClubMessageTemplates } from "@/lib/club";
import { requireAdmin } from "@/lib/authz";
import { NumField } from "@/components/ui/NumField";
import { ColorField } from "@/components/ui/ColorField";
import { Badge } from "@/components/ui/Badge";
import { formatDateFull } from "@/lib/format";
import { DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, DEFAULT_CONVOCATION_MESSAGE_TEMPLATE } from "@/lib/message-templates";
import { updateSettings, createSeason, setCurrentSeason, updateClub, updateMessageTemplates } from "./actions";

export default async function ParametresPage() {
  const [settings, admin, seasons, club, messageTemplates] = await Promise.all([
    getSettings(),
    requireAdmin(),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
    getClub(),
    getClubMessageTemplates(),
  ]);
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
          ["Responsable", admin.name, "accès complet"],
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
              <code>{"{{resultats}}"}</code> (résultats des matchs joués du week-end). Laisser vide pour revenir au texte par défaut.
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
    </div>
  );
}
