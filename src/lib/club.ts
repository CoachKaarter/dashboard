import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type ClubIdentity = {
  name: string;
  shortName: string | null;
  hasLogo: boolean;
  logoVersion: number; // updatedAt epoch ms — cache-busts /api/club/logo across changes
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

const FALLBACK: ClubIdentity = {
  name: "Mon club",
  shortName: null,
  hasLogo: false,
  logoVersion: 0,
  primaryColor: "#3F8F5B",
  secondaryColor: "#3C6E9F",
  accentColor: "#C97A17",
};

/**
 * Never returns logoData — pages that just need the identity (name, colors,
 * whether a logo exists) shouldn't pull the image bytes into every request.
 * Works before any admin has ever configured anything (§25 : the app must
 * function with zero Club row) — and, since this is read from the root
 * layout (every single page), it must also survive the window between a
 * deploy landing and its migration having actually run: any query error
 * here (including "relation does not exist") falls back rather than taking
 * the whole app down over a branding read.
 */
export const getClub = cache(async (): Promise<ClubIdentity> => {
  try {
    const club = await prisma.club.findUnique({ where: { id: 1 } });
    if (!club) return FALLBACK;
    return {
      name: club.name,
      shortName: club.shortName,
      hasLogo: !!club.logoData,
      logoVersion: club.updatedAt.getTime(),
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      accentColor: club.accentColor,
    };
  } catch {
    return FALLBACK;
  }
});
