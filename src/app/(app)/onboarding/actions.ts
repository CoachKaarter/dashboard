"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";

export async function completeOnboarding() {
  const user = await requireUser({ skipOnboardingCheck: true });
  await prisma.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date() } });
  redirect("/");
}
