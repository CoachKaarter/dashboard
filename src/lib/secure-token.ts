import { randomBytes, createHash } from "node:crypto";

// Shared by ParentInvitation and ParentPasswordResetToken — same discipline
// for both: a cryptographically random 32-byte token (never Math.random,
// never a short UUID used as a secret), hashed with SHA-256 before it ever
// touches the database. The raw token exists only twice: right after
// generation (to put in the link/email) and in the request that later
// redeems it — it is never logged, never stored, never put in ActivityLog.
export function generateSecureToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
