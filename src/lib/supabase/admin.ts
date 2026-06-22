import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Server-only Supabase client using the service-role key. Bypasses RLS.
 *
 * Sprint 01 simplification: the Tips Manager (backoffice) has no auth yet, so
 * it operates as a trusted server with the service role. When Supabase Auth is
 * added in a later sprint, manager queries should move to the per-owner
 * `lib/supabase/server.ts` client and scope by `owner_id`. The public guest
 * flow already uses the anon client + RLS policies — never use this client
 * from the public/guest surface.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
