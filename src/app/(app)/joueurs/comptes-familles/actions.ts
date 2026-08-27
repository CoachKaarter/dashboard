"use server";

import { requireAdmin } from "@/lib/authz";
import { createParentAccountForPlayer, type CreateAccountResult } from "@/lib/parent-account-creation";
import { revalidatePath } from "next/cache";

/**
 * Called once per player from a client-driven loop (BulkAccountCreationPanel)
 * rather than looping all ~96 players inside a single request — each call
 * does exactly one DB write + at most one Resend email, so there's no risk
 * of a bulk run outrunning the serverless function's time limit or Resend's
 * rate limit; the client controls concurrency and shows live progress.
 */
export async function createOneAccountBulkAction(playerId: string): Promise<CreateAccountResult> {
  await requireAdmin();
  const result = await createParentAccountForPlayer(playerId);
  revalidatePath("/joueurs/comptes-familles");
  if (result.ok) revalidatePath(`/joueurs/${playerId}`);
  return result;
}
