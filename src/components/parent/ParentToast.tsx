import { CheckIcon } from "./icons";

/** Small inline confirmation pill — never a big loader, never a page reload feel. */
export function ParentToast({ show, label = "Enregistré" }: { show: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] font-semibold text-green transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      aria-live="polite"
    >
      <CheckIcon size={13} />
      {label}
    </span>
  );
}
