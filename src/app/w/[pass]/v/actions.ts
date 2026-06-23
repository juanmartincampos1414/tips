"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipForRestaurant, logAudit } from "@/lib/auth";

/**
 * Claim validation (FR-021/022). Staff opens this via the pass QR and confirms.
 * Marks the reward claimed + the pass redeemed, and records a Return Visit.
 * Sprint 05A: requires an authenticated member of the restaurant (any role).
 * R7: a claimed/expired reward cannot be reused.
 */
export async function claimByPass(passIdentifier: string) {
  const supabase = createAdminClient();

  const { data: wp } = await supabase
    .from("wallet_passes")
    .select("id, reward_id, guest_id, restaurant_id")
    .eq("pass_identifier", passIdentifier)
    .maybeSingle();
  if (!wp) return;

  // Auth + role: only members of this restaurant can validate a claim.
  const membership = await getMembershipForRestaurant(wp.restaurant_id);
  if (!membership) return;

  const { data: reward } = await supabase
    .from("rewards")
    .select("id, status, expiration_date")
    .eq("id", wp.reward_id)
    .maybeSingle();
  if (!reward) return;

  if (new Date(reward.expiration_date).getTime() < Date.now()) {
    await supabase.from("rewards").update({ status: "expired" }).eq("id", reward.id);
    await supabase.from("wallet_passes").update({ status: "expired" }).eq("id", wp.id);
    revalidatePath(`/w/${passIdentifier}/v`);
    return;
  }
  if (reward.status !== "active") return;

  await supabase.from("rewards").update({ status: "claimed" }).eq("id", reward.id);
  await supabase
    .from("wallet_passes")
    .update({ status: "redeemed" })
    .eq("id", wp.id);
  await supabase.from("reward_claims").insert({
    reward_id: wp.reward_id,
    guest_id: wp.guest_id,
    restaurant_id: wp.restaurant_id,
  });
  await supabase.from("return_visits").insert({
    guest_id: wp.guest_id,
    reward_id: wp.reward_id,
    restaurant_id: wp.restaurant_id,
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
