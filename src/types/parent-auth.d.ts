import type { DefaultSession } from "next-auth";

// Deliberately not augmenting the "next-auth" module here (that's already
// done for the staff session shape in next-auth.d.ts) — this file just
// documents the parent JWT/session shape for src/parent-auth.ts consumers.
export type ParentSessionUser = {
  id: string;
  username: string;
} & DefaultSession["user"];
