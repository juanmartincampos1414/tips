import "server-only";

import { unsafeAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// Tenant resolution by TOKEN — the ONLY legitimate unscoped reads, for public /
// webhook flows that have no session. Each resolver looks up a row by an
// unguessable token (external_reference, provider_payment_id, pass id, slug…),
// returns it (incl. its restaurant_id), and the caller then switches to
// tenantDb(row.restaurant_id) for everything else. Allowlisted + audited; this
// is the single file where service-role + token lookup is allowed for payments
// and the Resend email webhook.
// =============================================================================

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
