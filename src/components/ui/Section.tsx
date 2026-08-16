import { ReactNode } from "react";

export function Section({
  title,
  hint,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`bg-surface border border-line rounded-lg overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-3.5 py-[11px] border-b border-line-soft">
          <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">{title}</span>
          <span className="flex-1" />
          {hint && <span className="text-[11.5px] text-muted-2">{hint}</span>}
          {right}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
