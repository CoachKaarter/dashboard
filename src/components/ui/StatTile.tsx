export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-3.5 py-2.5 min-w-[116px]">
      <div className="font-mono text-[19px] font-bold tracking-[-0.02em] text-ink">{value}</div>
      <div className="text-[10.5px] text-muted uppercase tracking-[0.07em] mt-0.5">{label}</div>
    </div>
  );
}
