import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents (marques diacritiques apres normalize NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Checked against ParentAccount.username (permanent, real accounts) AND
 * against live ParentInvitation.username (revokedAt: null — a reservation
 * held by an invitation not yet activated) — without the second check, two
 * different families with a same-name player (e.g. two "Léo Dupont" in
 * different teams) could both get "leo.dupont" reserved by two separate
 * pending invitations before either activates, and the second activation
 * would then collide with the first at the database's unique constraint.
 */
export async function generateUsername(firstName: string, lastName: string) {
  const base = `${slugify(firstName)}.${slugify(lastName)}`;
  let candidate = base;
  let n = 2;
  while (
    (await prisma.parentAccount.findUnique({ where: { username: candidate } })) ||
    (await prisma.parentInvitation.findFirst({ where: { username: candidate, revokedAt: null } }))
  ) {
    candidate = `${base}${n}`;
    n++;
  }
  return candidate;
}

const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // sans caracteres ambigus (0/O, 1/l/I)

export function generateTempPassword(length = 10) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => SAFE_CHARS[b % SAFE_CHARS.length]).join("");
}
