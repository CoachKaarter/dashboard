"use client";

export function NumField({ name, defaultValue, step }: { name: string; defaultValue: number | string; step?: string }) {
  return (
    <input
      name={name}
      type="number"
      step={step}
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="w-full h-7 border border-line rounded text-right font-mono text-[12px] px-1.5 outline-none focus:border-blue"
    />
  );
}
