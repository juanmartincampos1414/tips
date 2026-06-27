"use server";

import { revalidatePath } from "next/cache";

import { getMembershipForRestaurant, logAudit } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant/db";
import { resolveWalletPassRef } from "@/lib/tenant/resolve";

/**
 * Claim validation (FR-021/022). Staff opens this via the pass QR and confirms.
 * Marks the reward claimed + the pass redeemed, and records a Return Visit.
 * Sprint 05A: requires an authenticated member of the restaurant (any role).
 * R7: a claimed/expired reward cannot be reused.
 *
 * The pass is resolved by its token (resolveWalletPassRef) → restaurant_id; the
 * actor must be a member of that tenant, and every write goes through tenantDb.
 */
export async function claimByPass(passIdentifier: string) {
  const wp = await resolveWalletPassRef(passIdentifier);
  if (!wp) return;

  // Auth + role: only members of this restaurant can validate a claim.
  const membership = await getMembershipForRestaurant(wp.restaurant_id);
  if (!membership) return;

  const db = tenantDb(wp.restaurant_id);
  const { data: reward } = (await db
    .select("rewards", "id, status, expiration_date")
    .eq("id", wp.reward_id)
    .maybeSingle()) as {
    data: { id: string; status: string; expiration_date: string } | null;
  };
  if (!reward) return;

  if (new Date(reward.expiration_date).getTime() < Date.now()) {
    await db.update("rewards", { status: "expired" }).eq("id", reward.id);
    await db.update("wallet_passes", { status: "expired" }).eq("id", wp.id);
    revalidatePath(`/w/${passIdentifier}/v`);
    return;
  }
  if (reward.status !== "active") return;

  await db.update("rewards", { status: "claimed" }).eq("id", reward.id);
  await db.update("wallet_passes", { status: "redeemed" }).eq("id", wp.id);
  await db.insert("reward_claims", {
    reward_id: wp.reward_id,
    guest_id: wp.guest_id,
  });
  await db.insert("return_visits", {
    guest_id: wp.guest_id,
    reward_id: wp.reward_id,
  });

  await logAudit({
    restaurantId: wp.restaurant_id,
    userId: membership.userId,
    action: "reward.claimed",
    entityType: "reward",
    entityId: wp.reward_id,
    metadata: { via: "qr", pass: passIdentifier, role: membership.role },
  });

  revalidatePath(`/w/${passIdentifier}/v`);
  revalidatePath(`/w/${passIdentifier}`);
  revalidatePath("/dashboard");
  revalidatePath("/recompensas");
}
