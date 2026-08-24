"use client";

import { useState } from "react";

export function ColorField({ name, defaultValue, label }: { name: string; defaultValue: string; label: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-9 h-9 rounded-md border border-line cursor-pointer shrink-0 p-0.5 bg-surface"
          aria-label={label}
        />
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          maxLength={7}
          className="flex-1 h-9 border border-line rounded-md px-2 text-[12.5px] font-mono outline-none focus:border-blue"
        />
      </div>
    </label>
  );
}
