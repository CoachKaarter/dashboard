/**
 * V5.1 — visibilité/propriété de la bibliothèque (Partie C) : PERSONAL
 * (créateur + ADMIN uniquement) vs SHARED (tout staff autorisé au Cockpit
 * peut consulter/dupliquer/ajouter à ses séances, mais seul créateur+ADMIN
 * peut modifier/archiver l'original). Décisions pures — sans DB — pour
 * qu'elles soient directement testables, comme session-scope.ts.
 */
import type { AuthedUser } from "@/lib/authz";

export type OwnedVisibility = { createdById: string; visibility: string; archived: boolean };

/** Peut consulter (bibliothèque, fiche, ajout à une séance). */
export function canViewContentItem(user: AuthedUser, item: OwnedVisibility): boolean {
  if (user.role === "ADMIN") return true;
  if (item.visibility === "SHARED") return true;
  return item.createdById === user.id;
}

/** Peut modifier/archiver l'original — créateur ou ADMIN, que ce soit PERSONAL ou SHARED. */
export function canEditContentItem(user: AuthedUser, item: OwnedVisibility): boolean {
  return user.role === "ADMIN" || item.createdById === user.id;
}

// Un SessionTemplate suit exactement la même politique.
export const canViewTemplate = canViewContentItem;
export const canEditTemplate = canEditContentItem;
