export function AttendanceSummary({
  counts,
  total,
}: {
  counts: { P: number; R: number; AJ: number; ANJ: number; B: number };
  total: number;
}) {
  const pointed = counts.P + counts.R + counts.AJ + counts.ANJ + counts.B;
  const remaining = total - pointed;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
      {remaining > 0 ? (
        <div className="text-[15px] font-bold text-orange">
          {remaining} restent à pointer
        </div>
      ) : (
        <div className="text-[15px] font-bold text-green">✓ Pointage complet</div>
      )}
      <div className="text-[12.5px] text-[#6E7178] mt-0.5">
        {pointed} / {total} renseignés
      </div>
      <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden mt-2.5">
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300 ease-out"
          style={{ width: `${total > 0 ? Math.round((100 * pointed) / total) : 0}%` }}
        />
      </div>
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {([
          ["P", "text-green"],
          ["R", "text-orange"],
          ["AJ", "text-[#6E7178]"],
          ["ANJ", "text-red"],
          ["B", "text-red"],
        ] as const).map(([code, cls]) => (
          <div key={code} className="text-center">
            <div className={`font-mono text-[17px] font-bold transition-colors duration-200 ${cls}`}>{counts[code]}</div>
            <div className="text-[10px] text-[#9A9DA3] uppercase tracking-[0.05em]">{code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
