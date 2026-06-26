import "server-only";

import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/lib/auth";
import type { Role } from "@/lib/database.types";

// =============================================================================
// Tenant context — the active tenant (restaurant) for a manager request. The
// tenant key today is restaurant_id; the model leaves room for a future
// organization_id above it without re-migrating. Scoping needs only
// restaurantId; role/userId are for authorization + audit, never for scoping.
//
// Public / token flows do NOT produce a TenantContext (no user): they resolve a
// restaurantId by token (see tenant/resolve.ts, added per tier) and call
// tenantDb(restaurantId) directly.
// =============================================================================

export type TenantRole = Role; // "owner" | "manager" | "staff"

export type TenantContext = {
  restaurantId: string;
  userId: string;
  role: TenantRole;
};

/** The active tenant for the logged-in user, or null. */
export async function getActiveTenant(): Promise<TenantContext | null> {
  const m = await getCurrentMembership();
  if (!m) return null;
  // Single active membership today; a future tenant switcher selects among many.
  return { restaurantId: m.restaurantId, userId: m.userId, role: m.role };
}

/** Require any tenant membership (owner/manager/staff). */
export async function requireTenant(): Promise<TenantContext> {
  const t = await getActiveTenant();
  if (!t) redirect("/login");
  return t;
}

/** Require owner role on the active tenant. */
export async function requireOwnerTenant(): Promise<TenantContext> {
  const t = await getActiveTenant();
  if (!t || t.role !== "owner") redirect("/login");
  return t;
}
