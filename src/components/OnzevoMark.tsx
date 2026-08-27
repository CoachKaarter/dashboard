// Marque du produit (Onzevo — onzevo.website), distincte de l'identité du
// club affichée à côté (ex. "Saint-Sébastien FC") : Onzevo est la plateforme,
// le club est l'espace qui l'utilise — jamais confondus dans l'UI.
// Repère texte/CSS en attendant le logo réel fourni par l'utilisateur ; une
// fois disponible, remplacer le badge "11" par une <img> sans toucher aux
// appels de ce composant.
export function OnzevoMark({
  variant = "dark",
  size = "md",
  className = "",
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
}) {
  const badge = variant === "light" ? "bg-white text-sidebar" : "bg-sidebar text-white";
  const text = variant === "light" ? "text-white" : "text-ink";
  const dims = size === "sm" ? "w-6 h-6 text-[11px] rounded-[6px]" : "w-7 h-7 text-[13px] rounded-[7px]";
  const textSize = size === "sm" ? "text-[14px]" : "text-[17px]";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${dims} ${badge} flex items-center justify-center font-bold shrink-0`}
        style={{ fontFamily: "var(--font-barlow-condensed)" }}
        aria-hidden
      >
        11
      </span>
      <span className={`${textSize} ${text} font-bold tracking-[-0.01em]`} style={{ fontFamily: "var(--font-barlow-condensed)" }}>
        Onzevo
      </span>
    </div>
  );
}
