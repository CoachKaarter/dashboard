"use client";

import { useFormStatus } from "react-dom";

/**
 * Drop-in replacement for a plain `<button type="submit">` inside a
 * `<form action={...}>`. useFormStatus reads the pending state of the
 * nearest parent form automatically — no prop wiring needed from the form
 * itself, and the surrounding page stays a Server Component. Avoids a
 * full-screen spinner for something as small as "the button was pressed".
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} transition-all duration-150 active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
