"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function QuerySelect({
  paramKey,
  options,
}: {
  paramKey: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? options[0]?.value ?? "";

  return (
    <select
      value={current}
      onChange={(e) => {
        const usp = new URLSearchParams(searchParams.toString());
        if (e.target.value === options[0]?.value) usp.delete(paramKey);
        else usp.set(paramKey, e.target.value);
        const qs = usp.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
      className="h-[30px] border border-line rounded-md bg-surface text-[12.5px] px-2 text-ink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
