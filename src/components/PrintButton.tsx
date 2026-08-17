"use client";

export function PrintButton({ label = "Imprimer / Enregistrer en PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold cursor-pointer border-none"
    >
      {label}
    </button>
  );
}
