"use server";

import { parentSignIn } from "@/parent-auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function parentLoginAction(formData: FormData) {
  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(`parent-login:${ip}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!allowed) redirect("/parent/login?error=1");

  try {
    await parentSignIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/parent",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/parent/login?error=1");
    }
    throw e;
  }
}
