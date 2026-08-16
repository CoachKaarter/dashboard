"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-[13px] rounded-md bg-ink text-white text-[12.5px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-[#2A2E36]"
      >
        + Créer
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-56 bg-surface border border-line rounded-lg shadow-lg py-1.5 z-20">
          <Link
            href="/seances/nouvelle"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-[12.5px] font-medium hover:bg-bg"
          >
            Nouvelle séance
          </Link>
          <Link
            href="/matchs/nouveau"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2 text-[12.5px] font-medium hover:bg-bg"
          >
            Nouveau match
          </Link>
        </div>
      )}
    </div>
  );
}
