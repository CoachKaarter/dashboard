"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function QueryDateInput({ paramKey, defaultValue }: { paramKey: string; defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? defaultValue;

  return (
    <input
      type="date"
      value={current}
      onChange={(e) => {
        const usp = new URLSearchParams(searchParams.toString());
        if (e.target.value) usp.set(paramKey, e.target.value);
        else usp.delete(paramKey);
        const qs = usp.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
      className="h-[30px] border border-line rounded-md bg-surface text-[12.5px] px-2 text-ink"
    />
  );
}
