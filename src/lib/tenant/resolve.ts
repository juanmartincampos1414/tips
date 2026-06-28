import "server-only";

import { unsafeAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

// =============================================================================
// Tenant resolution by TOKEN — the ONLY legitimate unscoped reads, for public /
// webhook flows that have no session. Each resolver looks up a row by an
// unguessable token (external_reference, provider_payment_id, pass id, slug…),
// returns it (incl. its restaurant_id), and the caller then switches to
// tenantDb(row.restaurant_id) for everything else. Allowlisted + audited; this
// is the single file where service-role + token lookup is allowed for payments,
// the Resend email webhook, and public wallet passes.
// =============================================================================

type Reward = Database["public"]["Tables"]["rewards"]["Row"];
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];

export type ResolvedPayment = {
  id: string;
  restaurant_id: string;
  guest_id: string | null;
  staff_id: string | null;
  recognition_event_id: string | null;
  status: string;
  amount: number;
  currency: string;
  provider_payment_id: string | null;
  payment_method: string | null;
  failure_reason: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Resolve a payment by its provider tokens. Prefers external_reference (our own
 * idempotency key), falls back to provider_payment_id. Returns null if neither
 * matches. The token is the scope — only this one payment is returned.
 */
export async function resolvePaymentByToken(tokens: {
  externalReference?: string | null;
  providerPaymentId?: string | null;
}): Promise<ResolvedPayment | null> {
  const c = unsafeAdminClient();
  let q = c.from("payments").select("*");
  if (tokens.externalReference) q = q.eq("external_reference", tokens.externalReference);
  else if (tokens.providerPaymentId) q = q.eq("provider_payment_id", tokens.providerPaymentId);
  else return null;
  const { data } = await q.maybeSingle();
  return (data as ResolvedPayment | null) ?? null;
}

export type ResolvedEmailLog = {
  id: string;
  restaurant_id: string;
  guest_id: string | null;
};

/**
 * Resolve an email_log by the provider message id Resend sends in webhook
 * events. The provider id is the scope — only this one log is returned, and the
 * caller then operates with tenantDb(log.restaurant_id).
 */
export async function resolveEmailLogByProviderId(
  providerMessageId: string,
): Promise<ResolvedEmailLog | null> {
  const c = unsafeAdminClient();
  const { data } = await c
    .from("email_logs")
    .select("id, restaurant_id, guest_id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  return (data as ResolvedEmailLog | null) ?? null;
}

export type WalletPassFull = {
  id: string;
  pass_identifier: string;
  restaurant_id: string;
  status: Database["public"]["Tables"]["wallet_passes"]["Row"]["status"];
  rewards: {
    id: string;
    title: string;
    reward_type: Reward["reward_type"];
    value: number;
    status: Reward["status"];
    expiration_date: string;
  } | null;
  guests: { name: string | null } | null;
  restaurants: { name: string; logo_url: string | null; slug: string } | null;
};

/**
 * Public wallet pass resolution for DISPLAY (pass + reward + guest + restaurant).
 * The pass_identifier is the scope — only this one pass is returned. Read-only;
 * the wallet pages just render it.
 */
export async function resolveWalletPass(
  passIdentifier: string,
): Promise<WalletPassFull | null> {
  const c = unsafeAdminClient();
  const { data } = await c
    .from("wallet_passes")
    .select(
      "id, pass_identifier, restaurant_id, status, rewards(id, title, reward_type, value, status, expiration_date), guests(name), restaurants(name, logo_url, slug)",
    )
    .eq("pass_identifier", passIdentifier)
    .maybeSingle();
  return (data as WalletPassFull | null) ?? null;
}

export type ResolvedReviewRequest = {
  id: string;
  restaurant_id: string;
};

/**
 * Resolve a review_request by its id for the public review-status actions
 * (complete / feedback / ignore). The id is the scope — only this one request is
 * returned, and the caller then operates with tenantDb(rr.restaurant_id).
 */
export async function resolveReviewRequest(
  reviewRequestId: string,
): Promise<ResolvedReviewRequest | null> {
  const c = unsafeAdminClient();
  const { data } = await c
    .from("review_requests")
    .select("id, restaurant_id")
    .eq("id", reviewRequestId)
    .maybeSingle();
  return (data as ResolvedReviewRequest | null) ?? null;
}

export type WalletPassRef = {
  id: string;
  reward_id: string;
  guest_id: string;
  restaurant_id: string;
  status: Database["public"]["Tables"]["wallet_passes"]["Row"]["status"];
};

/**
 * Bare wallet pass resolution for the CLAIM mutation. Returns the foreign keys
 * the claim needs; the caller verifies membership of restaurant_id, then runs
 * every write through tenantDb(restaurant_id).
 */
export async function resolveWalletPassRef(
  passIdentifier: string,
): Promise<WalletPassRef | null> {
  const c = unsafeAdminClient();
  const { data } = await c
    .from("wallet_passes")
    .select("id, reward_id, guest_id, restaurant_id, status")
    .eq("pass_identifier", passIdentifier)
    .maybeSingle();
  return (data as WalletPassRef | null) ?? null;
}

/**
 * Public guest flow: resolve the staff member behind an NFC tap. URL is
 * /t/:slug/:code where :slug is the restaurant slug and :code is the band's uid.
 * The slug+uid are the scope (only an active, assigned band of an active
 * restaurant resolves); returns the active staff + restaurant, or null (→ 404).
 * The caller then operates with tenantDb(restaurant.id).
 */
export async function resolvePublicStaff(
  slug: string,
  code: string,
): Promise<{ restaurant: Restaurant; staff: Staff } | null> {
  const c = unsafeAdminClient();

  const { data: restaurant } = await c
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!restaurant) return null;

  // Resolve the band by its uid in the inventory (must be assigned).
  const { data: band } = await c
    .from("nfc_inventory")
    .select("assigned_staff_id")
    .eq("restaurant_id", restaurant.id)
    .eq("uid", code)
    .eq("status", "assigned")
    .maybeSingle();
  if (!band?.assigned_staff_id) return null;

  const { data: staff } = await c
    .from("staff")
    .select("*")
    .eq("id", band.assigned_staff_id)
    .eq("restaurant_id", restaurant.id)
    .eq("status", "active")
    .maybeSingle();
  if (!staff) return null;

  return { restaurant: restaurant as Restaurant, staff: staff as Staff };
}

export type ResolvedConnection = { restaurant_id: string };

/**
 * Resolve a tenant from the generic webhook path /api/webhooks/[provider].
 *
 * ⚠️ PLACEHOLDER — NOT a definitive multi-tenant webhook security design. It
 * picks the FIRST connection for the provider, so it is only valid for sandbox /
 * generic providers while no STRONG tenant identifier exists in the payload,
 * secret, signature, or a per-tenant endpoint. A real multi-tenant webhook MUST
 * resolve the tenant from such an identifier. Resend and Mercado Pago are out of
 * scope here — they have their own routes + specific resolvers.
 */
export async function resolveConnectionByProvider(
  provider: string,
): Promise<ResolvedConnection | null> {
  const c = unsafeAdminClient();
  const { data } = await c
    .from("connections")
    .select("restaurant_id")
    .eq("provider", provider)
    .limit(1)
    .maybeSingle();
  return (data as ResolvedConnection | null) ?? null;
}
