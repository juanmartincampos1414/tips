import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Server-only Supabase client using the service-role key. **Bypasses RLS and
 * has NO tenant scoping.** Product code must NOT use this directly — go through
 * `tenantDb(restaurantId)` (src/lib/tenant/db.ts), which injects/enforces the
 * `restaurant_id` filter. The only legitimate direct uses are the allowlisted
 * resolve-by-token / membership / provisioning paths (see src/lib/tenant/). A
 * build check (scripts/check-tenant-isolation.mjs) enforces this.
 */
export function unsafeAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * @deprecated Legacy alias kept so existing call sites keep working during the
 * Tenant Isolation migration. New code must use `tenantDb()`; this alias is
 * removed once all tiers are migrated (Phase 0 → tiers).
 */
export const createAdminClient = unsafeAdminClient;
