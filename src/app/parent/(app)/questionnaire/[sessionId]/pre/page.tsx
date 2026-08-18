import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireParentReady } from "@/lib/parent-guard";
import { sessionInParentScope } from "@/lib/parent-scope";
import { isPreOpen } from "@/lib/session-feedback";
import { submitPreFeedback } from "../../actions";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { SubmitButton } from "@/components/SubmitButton";

const FEELINGS = ["😩", "😕", "😐", "🙂", "😄"];
const FATIGUE = ["Pas du tout", "Un peu", "Beaucoup"];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function PreQuestionnairePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const parent = await requireParentReady();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent)) notFound();

  const feedback = await prisma.sessionFeedback.findUnique({
    where: { sessionId_playerId: { sessionId, playerId: parent.playerId } },
  });
  const done = !!feedback?.preAnsweredAt;
  const open = isPreOpen(session);

  return (
    <div className="flex flex-col gap-5 animate-fadein">
      <ParentPageHeader
        title="Ressenti avant séance"
        subtitle={`${DAY_NAMES[session.date.getDay()]} ${session.date.getDate()} ${MONTHS[session.date.getMonth()]} · ${session.startTime}`}
        backHref="/parent"
        backLabel="Accueil"
      />

      {done ? (
        <ParentCard className="text-center py-8">
          <div className="text-[34px] animate-checkpop" aria-hidden>✓</div>
          <div className="text-[18px] font-bold mt-2">Merci {parent.player.firstName} !</div>
          <div className="text-[14px] text-[#6E7178] mt-1">Bonne séance 👊</div>
          <Link href="/parent" className="inline-block mt-5 h-11 px-5 rounded-xl bg-ink text-white text-[14px] font-bold leading-[44px]">
            Retour à l&apos;accueil
          </Link>
        </ParentCard>
      ) : !open ? (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Ce questionnaire n&apos;est pas disponible pour le moment.</div>
        </ParentCard>
      ) : (
        <form action={submitPreFeedback.bind(null, sessionId)}>
          <ParentCard className="flex flex-col gap-5">
            <div>
              <div className="text-[14.5px] font-bold mb-2">Comment tu te sens aujourd&apos;hui ?</div>
              <div className="flex gap-1.5">
                {FEELINGS.map((e, i) => (
                  <label key={e} className="flex-1">
                    <input type="radio" name="preFeeling" value={i + 1} required className="peer sr-only" />
                    <div className="h-12 rounded-xl border-2 border-[#E7E7E2] bg-white text-[22px] flex items-center justify-center peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-105 transition-all duration-150">
                      {e}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[14.5px] font-bold mb-2">Tu te sens fatigué ?</div>
              <div className="flex gap-1.5">
                {FATIGUE.map((f) => (
                  <label key={f} className="flex-1">
                    <input type="radio" name="fatigue" value={f} required className="peer sr-only" />
                    <div className="h-11 rounded-xl border-2 border-[#E7E7E2] bg-white text-[12.5px] font-semibold flex items-center justify-center text-center px-1 peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-105 transition-all duration-150">
                      {f}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[14.5px] font-bold mb-2">Tu as une douleur ?</div>
              <div className="flex gap-1.5">
                {[["non", "Non"], ["oui", "Oui"]].map(([v, label]) => (
                  <label key={v} className="flex-1">
                    <input type="radio" name="pain" value={v} required className="peer sr-only" />
                    <div className="h-11 rounded-xl border-2 border-[#E7E7E2] bg-white text-[14px] font-semibold flex items-center justify-center peer-checked:bg-green-bg peer-checked:border-green peer-checked:scale-105 transition-all duration-150">
                      {label}
                    </div>
                  </label>
                ))}
              </div>
              <input
                name="painLocation"
                placeholder="Où as-tu mal ? (facultatif)"
                className="mt-2 h-11 w-full border border-[#E7E7E2] rounded-xl px-3.5 text-[14px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </div>

            <SubmitButton pendingLabel="Envoi…" className="h-12 rounded-xl bg-ink text-white text-[15px] font-bold">
              Envoyer
            </SubmitButton>
          </ParentCard>
        </form>
      )}
    </div>
  );
}
