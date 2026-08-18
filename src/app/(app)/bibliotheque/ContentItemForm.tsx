import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import type { TrainingContentItem, TrainingContentTag } from "@/generated/prisma/client";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";
const textareaClass = inputClass + " h-auto py-2 resize-y min-h-[70px]";

export function ContentItemForm({
  action,
  item,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  item?: (TrainingContentItem & { tags: TrainingContentTag[] }) | null;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Titre">
          <input name="title" required defaultValue={item?.title} className={inputClass} />
        </Field>
        <Field label="Type">
          <select name="type" required defaultValue={item?.type ?? "SITUATION"} className={inputClass}>
            {Object.entries(SESSION_BLOCK_TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description courte">
        <textarea name="description" defaultValue={item?.description ?? ""} className={textareaClass} rows={2} />
      </Field>

      <Field label="Objectif pédagogique">
        <textarea name="objective" defaultValue={item?.objective ?? ""} className={textareaClass} rows={2} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Organisation">
          <textarea name="organization" defaultValue={item?.organization ?? ""} className={textareaClass} rows={2} />
        </Field>
        <Field label="Consignes">
          <textarea name="instructions" defaultValue={item?.instructions ?? ""} className={textareaClass} rows={2} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Points de coaching">
          <textarea name="coachingPoints" defaultValue={item?.coachingPoints ?? ""} className={textareaClass} rows={3} />
        </Field>
        <Field label="Variantes">
          <textarea name="variations" defaultValue={item?.variations ?? ""} className={textareaClass} rows={3} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Espace / dimensions">
          <input name="space" placeholder="20 × 15" defaultValue={item?.space ?? ""} className={inputClass} />
        </Field>
        <Field label="Matériel">
          <input name="equipment" placeholder="12 coupelles, 4 ballons" defaultValue={item?.equipment ?? ""} className={inputClass} />
        </Field>
      </div>

      <Field label="Schéma (URL image, optionnel)">
        <input name="imageUrl" type="url" defaultValue={item?.imageUrl ?? ""} className={inputClass} />
      </Field>

      <div className="grid grid-cols-4 gap-3">
        <Field label="Durée par défaut (min)">
          <input name="defaultDurationMinutes" type="number" min={1} max={360} defaultValue={item?.defaultDurationMinutes ?? ""} className={inputClass} />
        </Field>
        <Field label="Min joueurs">
          <input name="minPlayers" type="number" min={1} max={30} defaultValue={item?.minPlayers ?? ""} className={inputClass} />
        </Field>
        <Field label="Max joueurs">
          <input name="maxPlayers" type="number" min={1} max={30} defaultValue={item?.maxPlayers ?? ""} className={inputClass} />
        </Field>
        <Field label="Format">
          <select name="format" defaultValue={item?.format ?? ""} className={inputClass}>
            <option value="">—</option>
            <option value="Foot à 5">Foot à 5</option>
            <option value="Foot à 8">Foot à 8</option>
            <option value="Foot à 11">Foot à 11</option>
            <option value="Tous">Tous</option>
          </select>
        </Field>
      </div>

      <Field label="Catégories conseillées (indicatif, séparées par une virgule)">
        <input name="categories" placeholder="U12, U13" defaultValue={item?.categories.join(", ") ?? ""} className={inputClass} />
      </Field>

      <Field label="Tags / principes (séparés par une virgule)">
        <input
          name="tags"
          placeholder="Scanning, Jeu de face, Renverser"
          defaultValue={item?.tags.map((t) => t.name).join(", ") ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Visibilité">
        <select name="visibility" defaultValue={item?.visibility ?? "PERSONAL"} className={inputClass}>
          <option value="PERSONAL">Personnel — visible uniquement par moi (+ admin)</option>
          <option value="SHARED">Partagé — visible par tout le staff</option>
        </select>
      </Field>

      <button type="submit" className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]">
        {submitLabel}
      </button>
    </form>
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
