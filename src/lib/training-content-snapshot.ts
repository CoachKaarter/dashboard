/**
 * V5.1 §2/§33 — principe d'historisation : ajouter un TrainingContentItem à
 * une séance doit produire une COPIE indépendante, jamais une référence live
 * vers la bibliothèque. Modifier l'item bibliothèque plus tard ne doit
 * jamais changer rétroactivement un SessionBlock déjà créé.
 *
 * Cette fonction pure isole exactement ce qui est copié — testable sans DB,
 * et le seul endroit qui doit changer si un nouveau champ pédagogique est
 * ajouté des deux côtés.
 */
export type LibrarySnapshotSource = {
  type: string;
  title: string;
  defaultDurationMinutes: number | null;
  objective: string | null;
  organization: string | null;
  instructions: string | null;
  coachingPoints: string | null;
  variations: string | null;
  space: string | null;
  equipment: string | null;
  imageUrl: string | null;
};

export function buildSessionBlockSnapshot(source: LibrarySnapshotSource & { id: string }, order: number) {
  return {
    order,
    type: source.type,
    title: source.title,
    durationMinutes: source.defaultDurationMinutes ?? 15,
    objective: source.objective,
    organization: source.organization,
    instructions: source.instructions,
    coachingPoints: source.coachingPoints,
    variations: source.variations,
    space: source.space,
    equipment: source.equipment,
    imageUrl: source.imageUrl,
    sourceLibraryItemId: source.id,
  };
}
