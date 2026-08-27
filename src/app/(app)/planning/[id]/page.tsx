import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { updateEvent, deleteEvent } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function EvenementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const event = await prisma.calendarEvent.findUnique({ where: { id }, include: { team: true } });
  if (!event) notFound();
  if (event.teamId && !canAccessTeam(user, event.teamId)) notFound();

  return (
    <div className="max-w-[560px] mx-auto animate-fadein">
      <Link href="/planning" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Planning
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Modifier l&apos;événement</div>
        <form action={updateEvent.bind(null, id)} className="flex flex-col gap-3.5">
          <Field label="Titre">
            <input name="title" required defaultValue={event.title} className={inputClass} />
          </Field>
          <Field label="Type">
            <select name="kind" defaultValue={event.kind} className={inputClass}>
              <option value="reunion">Réunion</option>
              <option value="tournoi">Tournoi</option>
              <option value="cohesion">Journée cohésion</option>
              <option value="autre">Autre</option>
            </select>
          </Field>
          <input type="hidden" name="teamLabel" value={event.teamLabel} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" name="date" required defaultValue={event.date.toISOString().slice(0, 10)} className={inputClass} />
            </Field>
            <Field label="Début">
              <input type="time" name="startTime" required defaultValue={event.startTime} className={inputClass} />
            </Field>
            <Field label="Fin">
              <input type="time" name="endTime" required defaultValue={event.endTime} className={inputClass} />
            </Field>
          </div>
          <Field label="Lieu (optionnel)">
            <input name="location" defaultValue={event.location ?? ""} className={inputClass} />
          </Field>
          <Field label="Programme de la journée (optionnel)">
            <textarea
              name="program"
              rows={4}
              defaultValue={event.program ?? ""}
              placeholder={"10h Accueil\n11h Ateliers\n12h30 Repas\n14h Tournoi interne\n16h Fin"}
              className={`${inputClass} h-auto py-2 resize-y`}
            />
          </Field>
          <p className="text-[11px] text-muted -mt-1.5">
            Visible par les familles dans leur planning uniquement pour une journée cohésion.
          </p>
          <button type="submit" className="h-10 border-none rounded-md bg-ink text-white text-[13px] font-semibold cursor-pointer mt-1 hover:bg-[#2A2E36]">
            Enregistrer
          </button>
        </form>
        <form action={deleteEvent.bind(null, id)} className="mt-3">
          <button type="submit" className="h-9 w-full border border-line rounded-md text-xs font-semibold text-red hover:border-red">
            Supprimer cet événement
          </button>
        </form>
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
