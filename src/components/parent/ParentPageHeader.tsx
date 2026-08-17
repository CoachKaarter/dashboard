import Link from "next/link";
import { ArrowLeftIcon } from "./icons";

export function ParentPageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div>
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1 text-[#8A8D93] text-[13px] font-medium mb-2 -ml-0.5 active:opacity-60">
          <ArrowLeftIcon size={15} />
          {backLabel ?? "Retour"}
        </Link>
      )}
      <div className="text-[24px] font-bold tracking-[-0.01em]">{title}</div>
      {subtitle && <div className="text-[13px] text-[#8A8D93] mt-0.5">{subtitle}</div>}
    </div>
  );
}
