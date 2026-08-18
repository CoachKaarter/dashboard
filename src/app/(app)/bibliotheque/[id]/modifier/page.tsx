import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { canEditContentItem } from "@/lib/training-content-scope";
import { updateContentItem } from "../../actions";
import { ContentItemForm } from "../../ContentItemForm";

export default async function ModifierProcedePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const item = await prisma.trainingContentItem.findUnique({ where: { id }, include: { tags: true } });
  if (!item) notFound();
  if (!canEditContentItem(user, item)) notFound();

  return (
    <div className="max-w-[700px] mx-auto animate-fadein">
      <Link href={`/bibliotheque/${id}`} className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← {item.title}
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Modifier le procédé</div>
        <ContentItemForm action={updateContentItem.bind(null, id)} item={item} submitLabel="Enregistrer" />
      </div>
    </div>
  );
}
