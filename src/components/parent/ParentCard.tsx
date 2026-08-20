export function ParentCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E7E7E2] p-4 ${className}`} style={style}>
      {children}
    </div>
  );
}
