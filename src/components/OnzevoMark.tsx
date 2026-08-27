// Marque du produit (Onzevo — onzevo.website), distincte de l'identité du
// club affichée à côté (ex. "Saint-Sébastien FC") : Onzevo est la plateforme,
// le club est l'espace qui l'utilise — jamais confondus dans l'UI.
//
// Reconstruction CSS/SVG du logo fourni par l'utilisateur (wordmark
// "ONZEVO" bold condensé légèrement penché, "ONZE" dans un vert sombre,
// "VO" dans un vert vif, surmonté d'un accent en forme de coche) — pas le
// fichier original : cette session n'a pas eu accès à l'image collée dans
// le chat (aucun fichier correspondant sur disque). Si un fichier (PNG/SVG)
// est déposé dans le dépôt ou fourni par URL, remplacer le contenu de ce
// composant par une <img>/<Image> pointant dessus, sans toucher aux appels.
const DARK_GREEN = "#0B3B2C";
const BRIGHT_GREEN = "#00E68A";

export function OnzevoMark({
  variant = "dark",
  size = "md",
  className = "",
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
}) {
  const onzeColor = variant === "light" ? "#FFFFFF" : DARK_GREEN;
  const textPx = size === "sm" ? 15 : 20;
  const tickHeight = textPx * 1.55;
  const tickWidth = textPx * 0.85;

  return (
    <div className={`inline-flex items-end ${className}`}>
      <span
        className="font-bold uppercase leading-none inline-block"
        style={{
          fontFamily: "var(--font-barlow-condensed)",
          fontSize: textPx,
          letterSpacing: "-0.01em",
          transform: "skewX(-9deg)",
          color: onzeColor,
        }}
      >
        onze
      </span>
      <svg
        width={tickWidth}
        height={tickHeight}
        viewBox="0 0 13 24"
        fill="none"
        aria-hidden
        style={{ marginBottom: -textPx * 0.08, marginLeft: 1, marginRight: -1 }}
      >
        <path d="M1 13.5L5.5 20L12 1" stroke={BRIGHT_GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className="font-bold uppercase leading-none inline-block"
        style={{
          fontFamily: "var(--font-barlow-condensed)",
          fontSize: textPx,
          letterSpacing: "-0.01em",
          transform: "skewX(-9deg)",
          color: BRIGHT_GREEN,
        }}
      >
        vo
      </span>
    </div>
  );
}
