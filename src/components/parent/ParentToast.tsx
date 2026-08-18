import { CheckIcon } from "./icons";

/** Small inline confirmation pill — never a big loader, never a page reload feel. */
export function ParentToast({ show, label = "Enregistré" }: { show: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] font-semibold text-green transition-all duration-200 ease-out ${
        show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
      }`}
      aria-live="polite"
    >
      <CheckIcon size={13} />
      {label}
    </span>
  );
}
