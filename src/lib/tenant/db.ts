import "server-only";

import { unsafeAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// tenantDb — the single chokepoint for tenant-scoped data access. It wraps the
// service-role client and STRUCTURALLY applies `restaurant_id` so a developer
// cannot forget it. Additional filters AND with the scope (PostgREST), so the
// scope can't be escaped. Product code uses this; the raw client is banned
// outside the allowlist (build check). Used only by migrated tiers — adding it
// changes no behavior until a tier adopts it.
// =============================================================================

// Tables with a direct `restaurant_id` column (auto-scoped). tips/ratings join
// this list once their column lands (migration 0020).
export type DirectTable =
  | "guests" | "rewards" | "payments" | "staff" | "recognition_events"
  | "tips" | "ratings" | "nfc_inventory" | "connections" | "email_logs"
  | "email_templates" | "email_events" | "review_requests" | "return_visits"
  | "campaigns" | "campaign_conversions" | "wallet_passes" | "guest_tags"
  | "guest_notes" | "guest_imports" | "guest_import_rows" | "import_logs"
  | "sync_jobs" | "reward_templates" | "reward_claims" | "restaurant_settings"
  | "integration_events" | "nfc_events" | "visits" | "payment_events"
  | "staff_settlements" | "restaurant_payouts" | "audit_logs"
  | "restaurant_members";

// Child tables (no restaurant_id) — scoped via a parent that itself is scoped.
export type ChildTable =
  | "payment_intents"
  | "campaign_recipients"
  | "campaign_audiences"
  | "nfc_tags";

const CHILD_PARENT: Record<ChildTable, { fk: string; parent: DirectTable; parentKey: string }> = {
  payment_intents: { fk: "payment_id", parent: "payments", parentKey: "id" },
  campaign_recipients: { fk: "campaign_id", parent: "campaigns", parentKey: "id" },
  campaign_audiences: { fk: "campaign_id", parent: "campaigns", parentKey: "id" },
  nfc_tags: { fk: "staff_id", parent: "staff", parentKey: "id" },
};

type Row = Record<string, unknown>;

export function tenantDb(restaurantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic wrapper
  const c = unsafeAdminClient() as any;

  return {
    /** SELECT on a DIRECT table, pre-scoped to the tenant. `options` forwards
     *  PostgREST select options (e.g. { count: "exact", head: true }). */
    select(table: DirectTable, columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
      return c.from(table).select(columns, options).eq("restaurant_id", restaurantId);
    },
    /** INSERT on a DIRECT table — injects restaurant_id into every row. */
    insert(table: DirectTable, rows: Row | Row[]) {
      const arr = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
        ...r,
        restaurant_id: restaurantId,
      }));
      return c.from(table).insert(arr);
    },
    /** UPSERT on a DIRECT table — injects restaurant_id into every row. */
    upsert(
      table: DirectTable,
      rows: Row | Row[],
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) {
      const arr = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
        ...r,
        restaurant_id: restaurantId,
      }));
      return c.from(table).upsert(arr, options);
    },
    /** UPDATE on a DIRECT table — pre-scoped; chain .eq("id", …). */
    update(table: DirectTable, patch: Row) {
      return c.from(table).update(patch).eq("restaurant_id", restaurantId);
    },
    /** DELETE on a DIRECT table — pre-scoped; chain .eq("id", …). */
    delete(table: DirectTable) {
      return c.from(table).delete().eq("restaurant_id", restaurantId);
    },

    /**
     * CHILD read: filter by the parent FK. The parentId MUST come from a
     * tenant-scoped read (invariant) — cheap and safe for reads.
     */
    child(table: ChildTable, parentId: string, columns = "*") {
      return c.from(table).select(columns).eq(CHILD_PARENT[table].fk, parentId);
    },

    /**
     * CHILD read over a SET of parents: filter by the parent FK ∈ parentIds.
     * The parentIds MUST come from a tenant-scoped read (invariant). Returns a
     * builder, so callers can chain .range()/.eq() (e.g. fetchAllRows).
     */
    childIn(table: ChildTable, parentIds: string[], columns = "*") {
      return c.from(table).select(columns).in(CHILD_PARENT[table].fk, parentIds);
    },

    /**
     * CHILD read by an arbitrary tenant-unique column (e.g. campaign_recipients
     * by email_log_id). INVARIANT: every value in `match` must derive from a
     * row already resolved within this tenant (an email_log resolved via the
     * tenant resolver, a recipient id from a scoped read). Returns a builder.
     */
    childMatch(table: ChildTable, match: Row, columns = "*") {
      return c.from(table).select(columns).match(match);
    },

    /**
     * CHILD update by an arbitrary tenant-unique key. Same invariant as
     * childMatch: `match` must derive from a tenant-scoped row.
     */
    childUpdate(table: ChildTable, match: Row, patch: Row) {
      return c.from(table).update(patch).match(match);
    },

    /**
     * CHILD write: VERIFY the parent belongs to this tenant first (one guard
     * query), then run the insert. Returns the inserted rows or throws.
     */
    async insertChild(table: ChildTable, parentId: string, rows: Row | Row[]) {
      const { parent, parentKey, fk } = CHILD_PARENT[table];
      const { data: ok } = await c
        .from(parent)
        .select(parentKey)
        .eq(parentKey, parentId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (!ok) throw new Error(`tenantDb: parent ${parent}/${parentId} not in tenant`);
      const arr = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, [fk]: parentId }));
      return c.from(table).insert(arr);
    },

    /**
     * CHILD upsert: VERIFY the parent belongs to this tenant first (one guard
     * query), then upsert. Injects the parent FK into every row. Forwards
     * PostgREST upsert options (onConflict / ignoreDuplicates).
     */
    async upsertChild(
      table: ChildTable,
      parentId: string,
      rows: Row | Row[],
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) {
      const { parent, parentKey, fk } = CHILD_PARENT[table];
      const { data: ok } = await c
        .from(parent)
        .select(parentKey)
        .eq(parentKey, parentId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (!ok) throw new Error(`tenantDb: parent ${parent}/${parentId} not in tenant`);
      const arr = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, [fk]: parentId }));
      return c.from(table).upsert(arr, options);
    },

    /** ROOT — the tenant's own restaurant row. */
    restaurant(columns = "*") {
      return c.from("restaurants").select(columns).eq("id", restaurantId);
    },
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;
