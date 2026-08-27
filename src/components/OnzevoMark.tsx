// Marque du produit (Onzevo — onzevo.website), distincte de l'identité du
// club affichée à côté (ex. "Saint-Sébastien FC") : Onzevo est la plateforme,
// le club est l'espace qui l'utilise — jamais confondus dans l'UI.
//
// Deux fichiers dérivés du logo fourni par l'utilisateur (public/onzevo-logo.png,
// rogné à son contenu réel) :
//  - onzevo-logo.png       : tel quel, pour fond clair ("onze" en vert sombre).
//  - onzevo-logo-light.png : "onze" remappé en blanc (le vert vif du "vo" est
//    conservé), généré par un script one-off (jamais commité) qui isole la
//    moitié sombre par seuil sur le canal vert — pour fond sombre, sans avoir
//    besoin d'une pastille derrière.
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
  const src = variant === "light" ? "/onzevo-logo-light.png" : "/onzevo-logo.png";

  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Onzevo" style={{ height: heightPx, width: "auto" }} />
    </span>
  );
}
