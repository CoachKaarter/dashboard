import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekendDate, getWindowForWeek, getPlayerWeekSessions } from "@/lib/availability";
import { setSessionAvailability, setSessionAbsenceReason, setWeekendAvailability, setWeekendAbsenceReason } from "./actions";

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const REASONS = ["Maladie", "Famille", "École", "Autre"];

function fmtDay(d: Date) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`;
}

export default async function ParentAccueilPage() {
  const parent = await requireParentReady();
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekend = getWeekendDate(weekStart);

  const [window, { player, sessions }, answers] = await Promise.all([
    getWindowForWeek(weekStart),
    getPlayerWeekSessions(parent.playerId, weekStart),
    prisma.playerAvailability.findMany({ where: { playerId: parent.playerId, weekStartDate: weekStart } }),
  ]);

  const answerBySession = new Map(answers.filter((a) => a.sessionId).map((a) => [a.sessionId, a]));
  const weekendAnswer = answers.find((a) => a.type === "WEEKEND");

  const isOpen = window?.status === "OPEN";
  const isLocked = window?.status === "LOCKED";
  const totalSlots = sessions.length + 1;
  const answeredCount = sessions.filter((s) => answerBySession.has(s.id)).length + (weekendAnswer ? 1 : 0);
  const weekStartIso = weekStart.toISOString();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-2xl font-bold tracking-[-0.01em]">Bonjour 👋</div>
        <div className="text-[17px] font-semibold text-[#3F8F5B] mt-0.5">{player.firstName}</div>
        <div className="text-[13px] text-[#8A8D93] mt-1">
          Semaine du {weekStart.getDate()} au {addDaysLabel(weekStart)}
        </div>
      </div>

      {isOpen && (
        <div className="rounded-xl px-3.5 py-3 bg-[#ECF5EF] border border-[#CFE6D6]">
          <div className="text-[13.5px] font-semibold text-[#3F8F5B]">🟢 Les présences sont ouvertes</div>
          {window?.closesAt && (
            <div className="text-[12px] text-[#5C8465] mt-0.5">
              À compléter avant le {fmtDay(new Date(window.closesAt))} {fmtTime(new Date(window.closesAt))}
            </div>
          )}
        </div>
      )}
      {!window || window.status === "CLOSED" ? (
        <div className="rounded-xl px-3.5 py-3 bg-[#F1F1EE] border border-[#E3E3DE]">
          <div className="text-[13.5px] font-semibold text-[#6E7178]">🔒 Les présences ne sont pas encore ouvertes</div>
        </div>
      ) : null}
      {isLocked && (
        <div className="rounded-xl px-3.5 py-3 bg-[#FDF3E4] border border-[#F0DFC0]">
          <div className="text-[13.5px] font-semibold text-[#C97A17]">🔒 Les présences de cette semaine sont clôturées</div>
          <div className="text-[12px] text-[#8A6A3A] mt-0.5">Pour signaler un changement, contacte le staff.</div>
        </div>
      )}

      {sessions.map((s) => {
        const answer = answerBySession.get(s.id);
        return (
          <div key={s.id} className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
            <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">{fmtDay(s.date)}</div>
            <div className="text-[15px] font-bold mt-0.5">Entraînement</div>
            <div className="text-[13px] text-[#6E7178] mt-0.5">
              {s.startTime} → {s.endTime} · {s.location}
            </div>

            {isOpen ? (
              <>
                <div className="flex gap-2 mt-3">
                  <form action={setSessionAvailability.bind(null, s.id, "AVAILABLE")} className="flex-1">
                    <button
                      type="submit"
                      className={`w-full h-12 rounded-xl text-[14px] font-bold border-2 ${
                        answer?.status === "AVAILABLE" ? "bg-[#3F8F5B] border-[#3F8F5B] text-white" : "bg-white border-[#E7E7E2] text-[#3F8F5B]"
                      }`}
                    >
                      ✓ Présent
                    </button>
                  </form>
                  <form action={setSessionAvailability.bind(null, s.id, "UNAVAILABLE")} className="flex-1">
                    <button
                      type="submit"
                      className={`w-full h-12 rounded-xl text-[14px] font-bold border-2 ${
                        answer?.status === "UNAVAILABLE" ? "bg-[#C4362C] border-[#C4362C] text-white" : "bg-white border-[#E7E7E2] text-[#C4362C]"
                      }`}
                    >
                      ✕ Absent
                    </button>
                  </form>
                </div>
                {answer?.status === "UNAVAILABLE" && (
                  <form action={setSessionAbsenceReason.bind(null, s.id)} className="mt-3 pt-3 border-t border-[#EFEFEC]">
                    <div className="text-[11.5px] font-semibold text-[#8A8D93] mb-1.5">Motif (facultatif)</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          type="submit"
                          name="absenceReason"
                          value={r}
                          className={`h-8 px-3 rounded-full text-[12.5px] font-semibold border ${
                            answer.absenceReason === r ? "bg-ink text-white border-ink" : "bg-white border-[#E7E7E2] text-[#6E7178]"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </form>
                )}
              </>
            ) : (
              <AnswerReadout status={answer?.status} />
            )}
          </div>
        );
      })}

      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">{fmtDay(weekend)}</div>
        <div className="text-[15px] font-bold mt-0.5">Disponibilité week-end</div>
        <div className="text-[13px] text-[#6E7178] mt-1">Ton enfant est-il disponible pour jouer ce week-end ?</div>

        {isOpen ? (
          <>
            <div className="flex gap-2 mt-3">
              <form action={setWeekendAvailability.bind(null, weekStartIso, "AVAILABLE")} className="flex-1">
                <button
                  type="submit"
                  className={`w-full h-12 rounded-xl text-[14px] font-bold border-2 ${
                    weekendAnswer?.status === "AVAILABLE" ? "bg-[#3F8F5B] border-[#3F8F5B] text-white" : "bg-white border-[#E7E7E2] text-[#3F8F5B]"
                  }`}
                >
                  ✓ Disponible
                </button>
              </form>
              <form action={setWeekendAvailability.bind(null, weekStartIso, "UNAVAILABLE")} className="flex-1">
                <button
                  type="submit"
                  className={`w-full h-12 rounded-xl text-[14px] font-bold border-2 ${
                    weekendAnswer?.status === "UNAVAILABLE" ? "bg-[#C4362C] border-[#C4362C] text-white" : "bg-white border-[#E7E7E2] text-[#C4362C]"
                  }`}
                >
                  ✕ Indisponible
                </button>
              </form>
            </div>
            {weekendAnswer?.status === "UNAVAILABLE" && (
              <form action={setWeekendAbsenceReason.bind(null, weekStartIso)} className="mt-3 pt-3 border-t border-[#EFEFEC]">
                <div className="text-[11.5px] font-semibold text-[#8A8D93] mb-1.5">Motif (facultatif)</div>
                <div className="flex gap-1.5 flex-wrap">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="submit"
                      name="absenceReason"
                      value={r}
                      className={`h-8 px-3 rounded-full text-[12.5px] font-semibold border ${
                        weekendAnswer.absenceReason === r ? "bg-ink text-white border-ink" : "bg-white border-[#E7E7E2] text-[#6E7178]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </form>
            )}
          </>
        ) : (
          <AnswerReadout status={weekendAnswer?.status} />
        )}
      </div>

      <div className="text-center text-[13px] font-semibold text-[#6E7178] py-2">
        {answeredCount === totalSlots ? (
          <span className="text-[#3F8F5B]">✓ Tout est renseigné pour cette semaine. Merci !</span>
        ) : isOpen ? (
          <span className="text-[#C97A17]">⚠ {totalSlots - answeredCount} réponse{totalSlots - answeredCount > 1 ? "s" : ""} à compléter</span>
        ) : (
          <span>{answeredCount} / {totalSlots} réponses renseignées</span>
        )}
      </div>
    </div>
  );
}

function AnswerReadout({ status }: { status?: string }) {
  if (!status) return <div className="mt-3 text-[13px] text-[#8A8D93] italic">Pas encore de réponse.</div>;
  return (
    <div className={`mt-3 text-[14px] font-bold ${status === "AVAILABLE" ? "text-[#3F8F5B]" : "text-[#C4362C]"}`}>
      {status === "AVAILABLE" ? "✓ Présent / Disponible" : "✕ Absent / Indisponible"}
    </div>
  );
}

function addDaysLabel(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${end.getDate()} ${MONTHS[end.getMonth()]}`;
}
