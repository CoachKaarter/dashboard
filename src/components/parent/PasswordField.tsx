"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

export function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-[#6E7178]">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          className="h-12 w-full border border-[#E7E7E2] rounded-xl pl-3.5 pr-11 text-[15px] bg-[#FCFCFB] outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-[#9A9DA3]"
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
    </label>
  );
}
