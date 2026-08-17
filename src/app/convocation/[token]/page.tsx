import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateFull } from "@/lib/format";
import { CopyButton } from "@/components/CopyButton";
import { confirmAttendance } from "./actions";

export default async function ConvocationPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const match = await prisma.match.findUnique({
    where: { shareToken: token },
    include: {
      team: true,
      convocations: { include: { player: true }, orderBy: { player: { lastName: "asc" } } },
    },
  });
  if (!match) notFound();

  const whatsappLines = [
    `Convocation ${match.team.code} — vs ${match.opponent ?? "adversaire à définir"}`,
    `${formatDateFull(match.date)}${match.time ? ` à ${match.time}` : ""}`,
    match.meetTime ? `Rendez-vous : ${match.meetTime}` : null,
    match.location ? `Lieu : ${match.location}` : null,
    "",
    "Joueurs convoqués :",
    ...match.convocations.map((c) => `- ${c.player.firstName} ${c.player.lastName}`),
  ].filter((l): l is string => l !== null);
  const whatsappText = whatsappLines.join("\n");

  return (
    <div className="min-h-full bg-[#F7F7F4] flex justify-center px-4 py-8">
      <div className="w-full max-w-[560px]">
        <div className="bg-white border border-[#E3E3DE] rounded-lg px-5 py-4 mb-3.5">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3] mb-1">Convocation</div>
          <div className="text-xl font-bold tracking-[-0.02em]">
            {match.team.code} vs {match.opponent ?? "Adversaire à définir"}
          </div>
          <div className="text-[13px] text-[#6E7178] mt-1.5">
            {formatDateFull(match.date)}{match.time ? ` à ${match.time}` : ""}
          </div>
          {match.meetTime && <div className="text-[13px] text-[#6E7178]">Rendez-vous : {match.meetTime}</div>}
          {match.location && <div className="text-[13px] text-[#6E7178]">Lieu : {match.location}</div>}

          <div className="flex gap-2 mt-3.5 pt-3 border-t border-[#EFEFEC]">
            <CopyButton
              text={whatsappText}
              label="Copier le message WhatsApp"
              className="h-9 px-3 border border-[#E3E3DE] rounded-md text-[12.5px] font-semibold text-[#16181C] hover:border-[#16181C] cursor-pointer bg-white"
            />
          </div>
        </div>

        <div className="bg-white border border-[#E3E3DE] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#EFEFEC] text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">
            Joueurs convoqués ({match.convocations.length})
          </div>
          {match.convocations.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#F2F2EF] last:border-b-0">
              <span className="text-[13.5px] font-medium flex-1">{c.player.firstName} {c.player.lastName}</span>
              <form action={confirmAttendance.bind(null, token, c.playerId, true)}>
                <button
                  type="submit"
                  className={`h-8 px-2.5 rounded-md text-[11.5px] font-semibold border cursor-pointer ${
                    c.confirmed === true ? "bg-[#EAF4EC] border-[#3F8F5B] text-[#3F8F5B]" : "bg-white border-[#E3E3DE] text-[#6E7178]"
                  }`}
                >
                  ✓ Je viens
                </button>
              </form>
              <form action={confirmAttendance.bind(null, token, c.playerId, false)}>
                <button
                  type="submit"
                  className={`h-8 px-2.5 rounded-md text-[11.5px] font-semibold border cursor-pointer ${
                    c.confirmed === false ? "bg-[#FBEAE8] border-[#C4362C] text-[#C4362C]" : "bg-white border-[#E3E3DE] text-[#6E7178]"
                  }`}
                >
                  ✗ Absent
                </button>
              </form>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-[#9A9DA3] text-center mt-4">Saint-Sébastien FC — U12/U13</div>
      </div>
    </div>
  );
}
