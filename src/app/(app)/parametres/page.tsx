import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/authz";
import { NumField } from "@/components/ui/NumField";
import { updateSettings } from "./actions";

export default async function ParametresPage() {
  const [settings, admin] = await Promise.all([getSettings(), requireAdmin()]);

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
          ["Saison", "2026 / 2027", "du 17 août 2026 au 30 juin 2027"],
          ["Club", "Saint-Sébastien FC", "catégorie U12 / U13"],
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
    </div>
  );
}
