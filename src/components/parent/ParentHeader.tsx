function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function ParentHeader({ firstName, category, subtitle }: { firstName: string; category: string; subtitle?: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9A9DA3]">Saint-Sébastien FC</div>
      <div className="text-[24px] font-bold tracking-[-0.01em] mt-1">
        {greeting()} <span aria-hidden>👋</span>
      </div>
      <div className="text-[15px] font-semibold text-green mt-0.5">
        {firstName} <span className="text-[#9A9DA3] font-medium">· {category}</span>
      </div>
      {subtitle && <div className="text-[13px] text-[#8A8D93] mt-1">{subtitle}</div>}
    </div>
  );
}
