import "server-only";

import { randomUUID } from "node:crypto";

import { unsafeAdminClient } from "@/lib/supabase/admin";
import { tenantDb, type TenantDb } from "@/lib/tenant/db";
import { resolvePaymentByToken } from "@/lib/tenant/resolve";
import type { Json } from "@/lib/database.types";

import { emitPaymentEvent } from "./events";
import { getPaymentProvider } from "./mercadopago";
import type { BusinessUnit, PaymentEventType, PaymentStatus, TipSource } from "./types";

// =============================================================================
// Payment service — the gateway-agnostic orchestration. Confirmation of money
// ALWAYS comes from the webhook, never the redirect. Idempotent on
// external_reference + provider_payment_id. The Core calls these, never MP.
// Tenant scoping via tenantDb; public/webhook flows resolve the tenant by token
// (tenant/resolve.ts) and then scope.
// =============================================================================

export type CreateTipResult = {
  ok: boolean;
  paymentId: string | null;
  checkoutUrl: string | null;
  externalReference: string | null;
  error?: string;
};

export async function createTipPayment(params: {
  restaurantId: string;
  guestId: string | null;
  staffId: string | null;
  recognitionEventId: string | null;
  amount: number;
  currency?: string;
  tipSource?: TipSource;
  businessUnit?: BusinessUnit;
  baseUrl: string;
  description?: string;
}): Promise<CreateTipResult> {
  const db = tenantDb(params.restaurantId);
  const provider = getPaymentProvider();
  const externalReference = randomUUID();

  const { data: payment, error } = await db
    .insert("payments", {
      guest_id: params.guestId,
      staff_id: params.staffId,
      recognition_event_id: params.recognitionEventId,
      provider: provider.name,
      external_reference: externalReference,
      amount: params.amount,
      currency: params.currency ?? "ARS",
      status: "pending",
      tip_source: params.tipSource ?? "nfc",
      business_unit: params.businessUnit ?? "restaurant",
    })
    .select("id")
    .single();
  if (error || !payment)
    return { ok: false, paymentId: null, checkoutUrl: null, externalReference: null, error: error?.message };

  await emitPaymentEvent({
    restaurantId: params.restaurantId,
    paymentId: payment.id,
    type: "PaymentCreated",
    payload: { amount: params.amount, source: params.tipSource ?? "nfc" },
  });

  const intent = await provider.createPayment({
    amount: params.amount,
    currency: params.currency ?? "ARS",
    externalReference,
    description: params.description ?? "Propina",
    returnUrl: `${params.baseUrl}/pay/${externalReference}/return`,
    notificationUrl: `${params.baseUrl}/api/webhooks/mercadopago`,
  });
  if (!intent.ok || !intent.checkoutUrl) {
    await db.update("payments", { status: "rejected", failure_reason: intent.error ?? "No se pudo crear el checkout" }).eq("id", payment.id);
    return { ok: false, paymentId: payment.id, checkoutUrl: null, externalReference, error: intent.error };
  }

  // payment_intents is a CHILD table → insertChild verifies the parent payment ∈ tenant.
  await db.insertChild("payment_intents", payment.id, {
    provider: provider.name,
    preference_id: intent.preferenceId,
    checkout_url: intent.checkoutUrl,
    expires_at: intent.expiresAt,
  });
  await emitPaymentEvent({ restaurantId: params.restaurantId, paymentId: payment.id, type: "CheckoutStarted" });

  return { ok: true, paymentId: payment.id, checkoutUrl: intent.checkoutUrl, externalReference };
}

const EVENT_FOR: Record<PaymentStatus, PaymentEventType | null> = {
  approved: "PaymentApproved",
  rejected: "PaymentRejected",
  cancelled: "PaymentCancelled",
  expired: "PaymentExpired",
  refunded: "RefundIssued",
  chargeback: "ChargebackCreated",
  pending: null,
  processing: null,
};

/**
 * Process a provider webhook end-to-end: parse → resolve payment (idempotent) →
 * update state → emit events → on approval confirm the recognition + create the
 * staff settlement. Never trust the redirect; this is the source of truth.
 */
export async function handlePaymentWebhook(payload: unknown): Promise<{ ok: boolean; message: string }> {
  const provider = getPaymentProvider();
  const parsed = await provider.webhook(payload);
  if (!parsed.ok || !parsed.status)
    return { ok: false, message: parsed.message };

  // Resolve by token (external_reference / provider_payment_id) → tenant, then scope.
  const payment = await resolvePaymentByToken({
    externalReference: parsed.externalReference,
    providerPaymentId: parsed.providerPaymentId,
  });
  if (!payment) return { ok: false, message: "Pago no encontrado" };
  const db = tenantDb(payment.restaurant_id);

  await emitPaymentEvent({
    restaurantId: payment.restaurant_id,
    paymentId: payment.id,
    type: "WebhookReceived",
    payload: { status: parsed.status },
  });

  // Idempotent: if already in this terminal state, do nothing further.
  if (payment.status === parsed.status)
    return { ok: true, message: "Ya procesado (idempotente)" };

  const isApproved = parsed.status === "approved";
  await db
    .update("payments", {
      status: parsed.status,
      provider_payment_id: parsed.providerPaymentId ?? payment.provider_payment_id,
      payment_method: parsed.method ?? payment.payment_method,
      failure_reason: parsed.failureReason ?? null,
      completed_at: isApproved ? new Date().toISOString() : payment.completed_at,
    })
    .eq("id", payment.id);

  const evt = EVENT_FOR[parsed.status];
  if (evt)
    await emitPaymentEvent({ restaurantId: payment.restaurant_id, paymentId: payment.id, type: evt, payload: { method: parsed.method } });

  if (isApproved) await onApproved(db, payment);

  return { ok: true, message: `Pago ${parsed.status}` };
}

/** On approval: confirm the recognition + create the staff settlement. */
async function onApproved(
  db: TenantDb,
  payment: { id: string; restaurant_id: string; staff_id: string | null; recognition_event_id: string | null; amount: number },
): Promise<void> {
  // DEBT (Tier 5 — Recognition): the recognition confirmation stays on the
  // unscoped client for now, but ONLY via this payment's already-resolved
  // recognition_event_id — never an open search of recognition_events.
  if (payment.recognition_event_id)
    await unsafeAdminClient()
      .from("recognition_events")
      .update({ confirmed: true })
      .eq("id", payment.recognition_event_id);
  if (payment.staff_id)
    await db.upsert(
      "staff_settlements",
      {
        staff_id: payment.staff_id,
        payment_id: payment.id,
        gross_amount: payment.amount,
        net_amount: payment.amount, // no commissions yet (out of scope)
        settlement_status: "pending",
      },
      { onConflict: "payment_id", ignoreDuplicates: true },
    );
}

/** Retry: re-query the provider for the truth + record the attempt. Idempotent. */
export async function retryPayment(restaurantId: string, paymentId: string): Promise<{ ok: boolean; message: string }> {
  const db = tenantDb(restaurantId);
  const { data: payment } = (await db
    .select("payments", "*")
    .eq("id", paymentId)
    .maybeSingle()) as {
    data: {
      id: string;
      restaurant_id: string;
      staff_id: string | null;
      recognition_event_id: string | null;
      amount: number;
      status: string;
      provider_payment_id: string | null;
      metadata: Record<string, unknown> | null;
    } | null;
  };
  if (!payment) return { ok: false, message: "Pago inexistente" };
  if (!payment.provider_payment_id)
    return { ok: false, message: "Sin provider_payment_id para reconsultar (esperando checkout)." };

  const provider = getPaymentProvider();
  const retry = (payment.metadata?.retry_count as number) ?? 0;
  await db
    .update("payments", { metadata: { ...(payment.metadata ?? {}), retry_count: retry + 1 } as Json })
    .eq("id", paymentId);

  const fetched = await provider.getPayment(payment.provider_payment_id);
  if (!fetched) return { ok: false, message: "No se pudo reconsultar el pago" };
  if (fetched.status !== payment.status) {
    await db.update("payments", { status: fetched.status }).eq("id", paymentId);
    const evt = EVENT_FOR[fetched.status];
    if (evt) await emitPaymentEvent({ restaurantId, paymentId, type: evt });
    if (fetched.status === "approved") await onApproved(db, payment);
  }
  return { ok: true, message: `Estado: ${fetched.status}` };
}

export async function refundPayment(restaurantId: string, paymentId: string): Promise<{ ok: boolean; message: string }> {
  const db = tenantDb(restaurantId);
  const { data: payment } = (await db
    .select("payments", "id, provider_payment_id, status")
    .eq("id", paymentId)
    .maybeSingle()) as { data: { provider_payment_id: string | null; status: string } | null };
  if (!payment) return { ok: false, message: "Pago inexistente" };
  if (payment.status !== "approved") return { ok: false, message: "Solo se reembolsan pagos aprobados." };

  const provider = getPaymentProvider();
  if (payment.provider_payment_id) await provider.refundPayment(payment.provider_payment_id);
  await db.update("payments", { status: "refunded" }).eq("id", paymentId);
  await db.update("staff_settlements", { settlement_status: "cancelled" }).eq("payment_id", paymentId);
  await emitPaymentEvent({ restaurantId, paymentId, type: "RefundIssued" });
  return { ok: true, message: "Reembolsado" };
}
