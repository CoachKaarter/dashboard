"use server";

import { parentSignIn } from "@/parent-auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function parentLoginAction(formData: FormData) {
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
