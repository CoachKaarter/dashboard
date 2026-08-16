"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw e;
  }
}
