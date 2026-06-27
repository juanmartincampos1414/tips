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
