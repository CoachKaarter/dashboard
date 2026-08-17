import Link from "next/link";
import { ChevronRightIcon } from "./icons";

/** The "for the player" teaser on Accueil — links to the dedicated page (spec §10). */
export function QuestionnaireCard({
  firstName,
  question,
  moment,
  seconds,
  href,
}: {
  firstName: string;
  question: string;
  moment: string;
  seconds: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-[#FFFCF6] border border-[#E4D9BE] rounded-2xl p-4 active:opacity-80"
    >
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#B08A3E]">Pour {firstName}</div>
      <div className="text-[15px] font-bold mt-0.5">{question}</div>
      <div className="text-[13px] text-[#6E7178] mt-0.5">{moment}</div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[12px] text-[#9A9DA3]">Environ {seconds} sec</span>
        <span className="inline-flex items-center gap-1 text-[13.5px] font-bold text-[#B08A3E]">
          Répondre <ChevronRightIcon size={15} />
        </span>
      </div>
    </Link>
  );
}
