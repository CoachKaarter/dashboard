// Minimal dependency-free SVG line chart for evaluation progression (1–5 scale).
export function ProgressChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return null;
  const width = 100;
  const height = 100;
  const padX = 6;
  const padY = 10;
  const min = 1;
  const max = 5;
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const y = (v: number) => height - padY - ((v - min) / (max - min)) * (height - padY * 2);
  const coords = points.map((p, i) => [padX + i * step, y(p.value)] as const);
  const path = coords.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x},${yy}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[110px]" preserveAspectRatio="none">
      {[1, 2, 3, 4, 5].map((v) => (
        <line key={v} x1={padX} x2={width - padX} y1={y(v)} y2={y(v)} stroke="#EFEFEC" strokeWidth={0.5} />
      ))}
      <path d={path} fill="none" stroke="#3F6FE0" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      {coords.map(([x, yy], i) => (
        <circle key={i} cx={x} cy={yy} r={1.8} fill="#3F6FE0" />
      ))}
    </svg>
  );
}
