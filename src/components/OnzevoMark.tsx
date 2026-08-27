// Marque du produit (Onzevo — onzevo.website), distincte de l'identité du
// club affichée à côté (ex. "Saint-Sébastien FC") : Onzevo est la plateforme,
// le club est l'espace qui l'utilise — jamais confondus dans l'UI.
//
// /public/onzevo-logo.png : placeholder généré par cette session (le
// fichier collé dans le chat par l'utilisateur n'était pas accessible sur
// le disque de cet environnement — voir le commit précédent). Remplacer
// ce fichier directement dans le dépôt pour mettre à jour le logo partout,
// sans toucher à ce composant.
//
// Le fichier a été composé en vert sombre/vert vif pour un fond clair. Sur
// un fond sombre (variant="light"), il est posé sur une pastille blanche
// plutôt que laissé tel quel, sinon la moitié sombre du mot devient
// illisible sur le fond quasi-noir de la sidebar/du panneau de connexion.
export function OnzevoMark({
  variant = "dark",
  size = "md",
  className = "",
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
}) {
  const heightPx = size === "sm" ? 18 : 24;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/onzevo-logo.png" alt="Onzevo" style={{ height: heightPx, width: "auto" }} />
  );

  if (variant === "light") {
    return (
      <span className={`inline-flex items-center bg-white rounded-md px-2 py-1 ${className}`}>{img}</span>
    );
  }

  return <span className={`inline-flex items-center ${className}`}>{img}</span>;
}
