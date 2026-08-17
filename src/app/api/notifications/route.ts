import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/authz";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({ items, unreadCount });
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.action === "readAll") {
    await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  } else if (body.action === "read" && typeof body.id === "string") {
    await prisma.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
