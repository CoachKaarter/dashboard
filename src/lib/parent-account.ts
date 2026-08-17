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

export async function generateUsername(firstName: string, lastName: string) {
  const base = `${slugify(firstName)}.${slugify(lastName)}`;
  let candidate = base;
  let n = 2;
  while (await prisma.parentAccount.findUnique({ where: { username: candidate } })) {
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
