"use client";

import { useState } from "react";

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // clipboard API unavailable (non-HTTPS or older browser) — no-op
        }
      }}
      className={className}
    >
      {copied ? "Copié !" : label}
    </button>
  );
}
