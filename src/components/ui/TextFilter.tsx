"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef } from "react";

export function TextFilter({ paramKey, placeholder }: { paramKey: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramValue = searchParams.get(paramKey) ?? "";

  const [value, setValue] = useState(paramValue);
  const [syncedFrom, setSyncedFrom] = useState(paramValue);
  if (paramValue !== syncedFrom) {
    setSyncedFrom(paramValue);
    setValue(paramValue);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const usp = new URLSearchParams(searchParams.toString());
      if (v) usp.set(paramKey, v);
      else usp.delete(paramKey);
      const qs = usp.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 250);
  }

  return (
    <input
      value={value}
      onChange={(e) => update(e.target.value)}
      placeholder={placeholder}
      className="h-[30px] border border-line rounded-md bg-surface text-[12.5px] px-2.5 text-ink outline-none focus:border-blue"
    />
  );
}
