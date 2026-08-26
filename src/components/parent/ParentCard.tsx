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
    <div className={`bg-white rounded-[18px] border border-[#E7E7E2] shadow-[0_2px_10px_rgba(23,31,62,0.06)] p-4 ${className}`} style={style}>
      {children}
    </div>
  );
}
