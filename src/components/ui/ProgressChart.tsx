// Minimal dependency-free SVG line chart. Defaults to a 1–5 scale (evaluations);
// pass min/max for other units (percentages, minutes...). Null values leave a
// gap in the line but keep their slot on the x-axis, so labels stay aligned.
export function ProgressChart({
  points,
  min = 1,
  max = 5,
  gridLines,
}: {
  points: { label: string; value: number | null }[];
  min?: number;
  max?: number;
  gridLines?: number[];
}) {
  if (points.length === 0) return null;
  const width = 100;
  const height = 100;
  const padX = 6;
  const padY = 10;
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const y = (v: number) => height - padY - ((v - min) / (max - min)) * (height - padY * 2);
  const coords = points.map((p, i) => (p.value === null ? null : ([padX + i * step, y(p.value)] as const)));

  const segments: string[] = [];
  let current: string | null = null;
  for (const c of coords) {
    if (!c) {
      current = null;
      continue;
    }
    current = current === null ? `M${c[0]},${c[1]}` : `${current} L${c[0]},${c[1]}`;
    const idx = coords.indexOf(c);
    if (idx === coords.length - 1 || coords[idx + 1] === null) {
      segments.push(current);
      current = null;
    }
  }
  const lines = gridLines ?? [min, (min + max) / 2, max];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[110px]" preserveAspectRatio="none">
      {lines.map((v) => (
        <line key={v} x1={padX} x2={width - padX} y1={y(v)} y2={y(v)} stroke="#EFEFEC" strokeWidth={0.5} />
      ))}
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#3F6FE0" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      ))}
      {coords.map((c, i) => (c ? <circle key={i} cx={c[0]} cy={c[1]} r={1.8} fill="#3F6FE0" /> : null))}
    </svg>
  );
}
