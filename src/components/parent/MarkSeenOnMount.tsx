"use client";

import { useEffect, useRef } from "react";
import { markParentContentSeen } from "@/app/parent/(app)/actions";

/**
 * Accueil Parent v2 — éteint l'animation NEW après le premier affichage
 * (spec : "l'animation ne doit jouer QUE lorsque state=NEW, jamais à
 * chaque ouverture"). Un ref évite un double appel en dev (Strict Mode) ou
 * si le composant se re-rend sans que la carte change. Fire-and-forget :
 * aucune UI ne dépend du résultat, la page ne se recharge pas.
 */
export function MarkSeenOnMount({ entityType, entityId }: { entityType: string; entityId: string }) {
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    const key = `${entityType}:${entityId}`;
    if (firedFor.current === key) return;
    firedFor.current = key;
    markParentContentSeen(entityType, entityId).catch(() => {});
  }, [entityType, entityId]);

  return null;
}
