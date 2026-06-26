import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

import { emitPaymentEvent } from "./events";
import { getPaymentProvider } from "./mercadopago";
import type { BusinessUnit, PaymentEventType, PaymentStatus, TipSource } from "./types";

// =============================================================================
// Payment service — the gateway-agnostic orchestration. Confirmation of money
// ALWAYS comes from the webhook, never the redirect. Idempotent on
// external_reference + provider_payment_id. The Core calls these, never MP.
// =============================================================================

type Admin = ReturnType<typeof createAdminClient>;

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
  const supabase = createAdminClient();
  const provider = getPaymentProvider();
  const externalReference = randomUUID();

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      restaurant_id: params.restaurantId,
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
    await supabase.from("payments").update({ status: "rejected", failure_reason: intent.error ?? "No se pudo crear el checkout" }).eq("id", payment.id);
    return { ok: false, paymentId: payment.id, checkoutUrl: null, externalReference, error: intent.error };
  }

  await supabase.from("payment_intents").insert({
    payment_id: payment.id,
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
  const supabase = createAdminClient();
  const provider = getPaymentProvider();
  const parsed = await provider.webhook(payload);
  if (!parsed.ok || !parsed.status)
    return { ok: false, message: parsed.message };

  // Resolve the payment (idempotency keys: external_reference, provider_payment_id).
  let query = supabase.from("payments").select("*");
  if (parsed.externalReference) query = query.eq("external_reference", parsed.externalReference);
  else if (parsed.providerPaymentId) query = query.eq("provider_payment_id", parsed.providerPaymentId);
  else return { ok: false, message: "Webhook sin referencia" };
  const { data: payment } = await query.maybeSingle();
  if (!payment) return { ok: false, message: "Pago no encontrado" };

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
  await supabase
    .from("payments")
    .update({
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

  if (isApproved) await onApproved(supabase, payment);

  return { ok: true, message: `Pago ${parsed.status}` };
}

/** On approval: confirm the recognition + create the staff settlement. */
async function onApproved(
  supabase: Admin,
  payment: { id: string; restaurant_id: string; staff_id: string | null; recognition_event_id: string | null; amount: number },
): Promise<void> {
  if (payment.recognition_event_id)
    await supabase.from("recognition_events").update({ confirmed: true }).eq("id", payment.recognition_event_id);
  if (payment.staff_id)
    await supabase.from("staff_settlements").upsert(
      {
        restaurant_id: payment.restaurant_id,
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
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!payment) return { ok: false, message: "Pago inexistente" };
  if (!payment.provider_payment_id)
    return { ok: false, message: "Sin provider_payment_id para reconsultar (esperando checkout)." };

  const provider = getPaymentProvider();
  const retry = ((payment.metadata as Record<string, unknown>)?.retry_count as number) ?? 0;
  await supabase
    .from("payments")
    .update({ metadata: { ...((payment.metadata as Record<string, unknown>) ?? {}), retry_count: retry + 1 } as Json })
    .eq("id", paymentId);

  const fetched = await provider.getPayment(payment.provider_payment_id);
  if (!fetched) return { ok: false, message: "No se pudo reconsultar el pago" };
  if (fetched.status !== payment.status) {
    await supabase.from("payments").update({ status: fetched.status }).eq("id", paymentId);
    const evt = EVENT_FOR[fetched.status];
    if (evt) await emitPaymentEvent({ restaurantId, paymentId, type: evt });
    if (fetched.status === "approved") await onApproved(supabase, payment);
  }
  return { ok: true, message: `Estado: ${fetched.status}` };
}

export async function refundPayment(restaurantId: string, paymentId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, provider_payment_id, status")
    .eq("id", paymentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!payment) return { ok: false, message: "Pago inexistente" };
  if (payment.status !== "approved") return { ok: false, message: "Solo se reembolsan pagos aprobados." };

  const provider = getPaymentProvider();
  if (payment.provider_payment_id) await provider.refundPayment(payment.provider_payment_id);
  await supabase.from("payments").update({ status: "refunded" }).eq("id", paymentId);
  await supabase.from("staff_settlements").update({ settlement_status: "cancelled" }).eq("payment_id", paymentId);
  await emitPaymentEvent({ restaurantId, paymentId, type: "RefundIssued" });
  return { ok: true, message: "Reembolsado" };
}
