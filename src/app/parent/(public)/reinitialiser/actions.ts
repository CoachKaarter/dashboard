"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { parentSignIn } from "@/parent-auth";
import { consumeResetToken } from "@/lib/parent-password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const COOKIE_NAME = "parent-reset";

export async function resetPasswordAction(formData: FormData) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) redirect("/parent/reinitialiser");

  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 10) redirect("/parent/reinitialiser?error=court");
  if (password !== confirm) redirect("/parent/reinitialiser?error=diff");

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(`reset-submit:${ip}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!allowed) redirect("/parent/reinitialiser?error=invalid");

  const result = await consumeResetToken(token, password);
  if (!result.ok) redirect("/parent/reinitialiser");

  store.delete(COOKIE_NAME);

  try {
    await parentSignIn("credentials", { username: result.username, password, redirectTo: "/parent" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/parent/login");
    throw e;
  }
}
