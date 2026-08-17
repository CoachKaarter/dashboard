"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/parent-session";
import { redirect } from "next/navigation";

export async function changeParentPassword(formData: FormData) {
  const parent = await requireParent();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 6) redirect("/parent/changer-mot-de-passe?error=court");
  if (password !== confirm) redirect("/parent/changer-mot-de-passe?error=diff");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.parentAccount.update({
    where: { id: parent.parentAccountId },
    data: { passwordHash, mustChangePassword: false },
  });
  redirect("/parent");
}
