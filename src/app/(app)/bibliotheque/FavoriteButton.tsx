"use client";

import { useTransition } from "react";
import { toggleFavorite } from "./actions";

export function FavoriteButton({ contentItemId, active }: { contentItemId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      disabled={pending}
      onClick={() => startTransition(() => toggleFavorite(contentItemId))}
      className={`text-[15px] leading-none cursor-pointer bg-transparent border-none p-0 ${active ? "text-orange" : "text-[#C9CBC7] hover:text-orange"}`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
