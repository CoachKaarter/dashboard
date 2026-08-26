function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function ParentHeader({
  firstName,
  category,
  subtitle,
}: {
  firstName: string;
  category: string;
  subtitle?: string;
  /** @deprecated club identity now lives in the persistent ParentHeaderBar/ParentTopNav, not repeated here. */
  clubName?: string;
}) {
  return (
    <div>
      <div className="text-[27px] font-bold tracking-[-0.01em]" style={{ fontFamily: "var(--font-parent-display)" }}>
        {greeting()}
      </div>
      <div className="text-[15px] font-semibold text-green mt-0.5">
        {firstName} <span className="text-[#9A9DA3] font-medium">· {category}</span>
      </div>
      {subtitle && <div className="text-[13px] text-[#8A8D93] mt-1">{subtitle}</div>}
    </div>
  );
}
