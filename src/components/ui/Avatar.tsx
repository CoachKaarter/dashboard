export function Avatar({
  initials,
  size = 26,
  tone = "neutral",
}: {
  initials: string;
  size?: number;
  tone?: "neutral" | "red";
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border border-line font-bold text-ink-soft shrink-0 ${
        tone === "red" ? "bg-red-bg" : "bg-line-soft"
      }`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </div>
  );
}
