import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { createContentItem } from "../actions";
import { ContentItemForm } from "../ContentItemForm";

export default async function NouveauProcedePage() {
  await requireUser();
  return (
    <div className="max-w-[700px] mx-auto animate-fadein">
      <Link href="/bibliotheque" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Bibliothèque
      </Link>
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-lg font-bold tracking-[-0.01em] mb-4">Nouveau procédé</div>
        <ContentItemForm action={createContentItem} submitLabel="Créer le procédé" />
      </div>
    </div>
  );
}
