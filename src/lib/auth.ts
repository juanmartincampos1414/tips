import "server-only";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Role } from "@/lib/database.types";

export type Membership = {
  userId: string;
  restaurantId: string;
  role: Role;
  staffId: string | null;
};

/** The logged-in user, or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * The logged-in user's restaurant membership + role (source of truth for
 * access). Returns null if not logged in or not a member of any restaurant.
 */
export async function getCurrentMembership(): Promise<Membership | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurant_members")
    .select("restaurant_id, role, staff_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  return {
    userId: user.id,
    restaurantId: data.restaurant_id,
    role: data.role,
    staffId: data.staff_id,
  };
}

/** Membership for a specific restaurant (used by claim validation). */
export async function getMembershipForRestaurant(
  restaurantId: string,
): Promise<Membership | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurant_members")
    .select("role, staff_id")
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!data) return null;

  return {
    userId: user.id,
    restaurantId,
    role: data.role,
    staffId: data.staff_id,
  };
}

export const MANAGER_ROLES: Role[] = ["owner", "manager"];

/** Require an owner/manager membership for a mutating manager action. */
export async function requireManager(): Promise<Membership> {
  const membership = await getCurrentMembership();
  if (!membership || !MANAGER_ROLES.includes(membership.role)) {
    redirect("/login");
  }
  return membership;
}

/** Require an owner membership (team + settings). */
export async function requireOwner(): Promise<Membership> {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") {
    redirect("/login");
  }
  return membership;
}

/** Record a sensitive action in the audit log. */
export async function logAudit(params: {
  restaurantId: string | null;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Json;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    restaurant_id: params.restaurantId,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
  });
}
