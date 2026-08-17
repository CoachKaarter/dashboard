export function ParentCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-[#E7E7E2] p-4 ${className}`}>{children}</div>;
}
