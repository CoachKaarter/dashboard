import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { SESSION_BLOCK_TYPE_LABELS } from "@/lib/constants";
import { SessionTimer } from "@/components/coach/SessionTimer";
import { ArrowLeftIcon, ChevronRightIcon, ImageIcon } from "@/components/coach/icons";
import { startBlock, completeBlock, skipBlock } from "./actions";

export default async function ProcedeDetailPage({
  params,
}: {
  params: Promise<{ id: string; blockId: string }>;
}) {
  const { id, blockId } = await params;
  const user = await requireUser();
  const session = await prisma.trainingSession.findUnique({ where: { id } });
  if (!session) notFound();
  if (!(await canAccessSession(user, session))) notFound();

  const blocks = await prisma.sessionBlock.findMany({ where: { sessionId: id }, orderBy: { order: "asc" } });
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index === -1) notFound();
  const block = blocks[index];
  const next = blocks[index + 1];

  const boundStart = startBlock.bind(null, id, blockId);
  const boundComplete = completeBlock.bind(null, id, blockId);
  const boundSkip = skipBlock.bind(null, id, blockId);

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <Link href={`/coach/seances/${id}?tab=seance`} className="inline-flex items-center gap-1 text-[#8A8D93] text-[13px] font-medium -ml-0.5">
        <ArrowLeftIcon size={15} /> Séance
      </Link>

      <div>
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-green">
          {index + 1} / {blocks.length} — {SESSION_BLOCK_TYPE_LABELS[block.type] ?? block.type}
        </div>
        <div className="text-[21px] font-bold tracking-[-0.01em] mt-0.5">{block.title}</div>
        <div className="text-[13.5px] text-[#6E7178] mt-0.5">{block.durationMinutes} min prévues</div>
      </div>

      <SessionTimer
        plannedMinutes={block.durationMinutes}
        status={block.status}
        startedAt={block.startedAt}
        onStart={boundStart}
        onComplete={boundComplete}
        onSkip={boundSkip}
      />

      {block.status === "DONE" && block.actualDurationMinutes !== null && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex gap-5">
          <div>
            <div className="text-[10.5px] text-[#9A9DA3] uppercase tracking-[0.05em]">Prévu</div>
            <div className="font-mono text-[16px] font-bold mt-0.5">{block.durationMinutes} min</div>
          </div>
          <div>
            <div className="text-[10.5px] text-[#9A9DA3] uppercase tracking-[0.05em]">Réalisé</div>
            <div className="font-mono text-[16px] font-bold mt-0.5">{block.actualDurationMinutes} min</div>
          </div>
        </div>
      )}

      {block.objective && <InfoBlock label="Objectif" text={block.objective} />}
      {block.organization && <InfoBlock label="Organisation" text={block.organization} />}
      {block.space && <InfoBlock label="Espace" text={block.space} />}
      {block.equipment && <InfoBlock label="Matériel" text={block.equipment} />}
      {block.instructions && <InfoBlock label="Consignes" text={block.instructions} multiline />}
      {block.coachingPoints && <InfoBlock label="Points de coaching" text={block.coachingPoints} multiline />}
      {block.variations && <InfoBlock label="Variantes" text={block.variations} multiline />}

      {block.imageUrl && (
        <details className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
          <summary className="cursor-pointer px-4 py-3.5 flex items-center gap-2 text-[13.5px] font-bold select-none">
            <ImageIcon size={16} /> Voir le schéma
          </summary>
          {/* eslint-disable-next-line @next/next/no-img-element -- coach-provided URL, not a local/optimizable asset */}
          <img src={block.imageUrl} alt={`Schéma — ${block.title}`} className="w-full h-auto border-t border-[#EFEFEC]" />
        </details>
      )}

      {block.coachNote && (
        <div className="bg-[#FFFCF6] border border-[#E4D9BE] rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#B08A3E]">À observer</div>
          <div className="text-[13.5px] text-[#6E7178] mt-1.5 whitespace-pre-wrap">{block.coachNote}</div>
        </div>
      )}

      {next && (
        <Link
          href={`/coach/seances/${id}/procede/${next.id}`}
          className="h-12 rounded-xl border-2 border-[#E7E7E2] text-[14px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform duration-100"
        >
          Procédé suivant <ChevronRightIcon size={16} />
        </Link>
      )}
    </div>
  );
}

function InfoBlock({ label, text, multiline = false }: { label: string; text: string; multiline?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
      <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#9A9DA3]">{label}</div>
      <div className={`text-[14px] text-ink mt-1 ${multiline ? "whitespace-pre-wrap leading-relaxed" : "font-semibold"}`}>{text}</div>
    </div>
  );
}
