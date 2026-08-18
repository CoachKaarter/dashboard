import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireParentReady } from "@/lib/parent-guard";
import { sessionInParentScope } from "@/lib/parent-scope";
import { isPostOpen } from "@/lib/session-feedback";
import { submitPostFeedback } from "../../actions";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { SubmitButton } from "@/components/SubmitButton";

const FEELINGS = ["😩", "😕", "😐", "🙂", "😄"];
const ENJOYMENT: [string, string][] = [["1", "😕 Pas trop"], ["2", "🙂 Bien"], ["3", "😍 Beaucoup"]];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function PostQuestionnairePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const parent = await requireParentReady();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent)) notFound();

  const feedback = await prisma.sessionFeedback.findUnique({
    where: { sessionId_playerId: { sessionId, playerId: parent.playerId } },
  });
  const done = !!feedback?.postAnsweredAt;
  const open = isPostOpen(session);

  return (
    <div className="flex flex-col gap-5 animate-fadein">
      <ParentPageHeader
        title="Ressenti après séance"
        subtitle={`${DAY_NAMES[session.date.getDay()]} ${session.date.getDate()} ${MONTHS[session.date.getMonth()]} · ${session.startTime}`}
        backHref="/parent"
        backLabel="Accueil"
      />

      {done ? (
        <ParentCard className="text-center py-8">
          <div className="text-[34px] animate-checkpop" aria-hidden>✓</div>
          <div className="text-[18px] font-bold mt-2">Merci pour ton retour !</div>
          <Link href="/parent" className="inline-block mt-5 h-11 px-5 rounded-xl bg-ink text-white text-[14px] font-bold leading-[44px]">
            Retour à l&apos;accueil
          </Link>
        </ParentCard>
      ) : !open ? (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Ce questionnaire n&apos;est pas disponible pour le moment.</div>
        </ParentCard>
      ) : (
        <form action={submitPostFeedback.bind(null, sessionId)}>
          <ParentCard className="flex flex-col gap-5">
            <div>
              <div className="text-[14.5px] font-bold mb-2">Comment tu t&apos;es senti pendant la séance ?</div>
              <div className="flex gap-1.5">
                {FEELINGS.map((e, i) => (
                  <label key={e} className="flex-1">
                    <input type="radio" name="postFeeling" value={i + 1} required className="peer sr-only" />
                    <div className="h-12 rounded-xl border-2 border-[#E7E7E2] bg-white text-[22px] flex items-center justify-center peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-105 transition-all duration-150">
                      {e}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[14.5px] font-bold mb-1">La séance était difficile comment ?</div>
              <div className="flex justify-between text-[10.5px] text-[#9A9DA3] font-semibold mb-2 px-0.5">
                <span>1 · Très facile</span>
                <span>5 · Moyenne</span>
                <span>10 · Très difficile</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <label key={n}>
                    <input type="radio" name="rpe" value={n} required className="peer sr-only" />
                    <div className="h-10 rounded-lg border-2 border-[#E7E7E2] bg-white text-[13.5px] font-bold flex items-center justify-center peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-105 transition-all duration-150">
                      {n}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[14.5px] font-bold mb-2">As-tu aimé la séance ?</div>
              <div className="flex gap-1.5">
                {ENJOYMENT.map(([v, label]) => (
                  <label key={v} className="flex-1">
                    <input type="radio" name="enjoyment" value={v} required className="peer sr-only" />
                    <div className="h-11 rounded-xl border-2 border-[#E7E7E2] bg-white text-[13px] font-semibold flex items-center justify-center text-center px-1 peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-105 transition-all duration-150">
                      {label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <textarea
              name="comment"
              placeholder="Quelque chose à ajouter ? (facultatif)"
              rows={2}
              className="border border-[#E7E7E2] rounded-xl px-3.5 py-3 text-[14px] bg-[#FCFCFB] outline-none resize-y focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
            />

            <SubmitButton pendingLabel="Envoi…" className="h-12 rounded-xl bg-ink text-white text-[15px] font-bold">
              Envoyer
            </SubmitButton>
          </ParentCard>
        </form>
      )}
    </div>
  );
}
