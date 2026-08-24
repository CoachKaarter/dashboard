import { prisma } from "@/lib/prisma";

// Public — the logo needs to render on the login pages and every app
// surface (Cockpit, Coach, Parent), not just for authenticated requests.
export async function GET() {
  const club = await prisma.club.findUnique({ where: { id: 1 }, select: { logoData: true, logoMimeType: true } });
  if (!club?.logoData || !club.logoMimeType) {
    return new Response(null, { status: 404 });
  }
  return new Response(new Uint8Array(club.logoData), {
    headers: {
      "Content-Type": club.logoMimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
