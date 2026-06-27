import "server-only";

import { emitEvent } from "@/lib/integrations/events";
import { tenantDb } from "@/lib/tenant/db";
import type { Json } from "@/lib/database.types";

import type { PaymentEventType } from "./types";

// =============================================================================
// Payment events — never mutate payment state directly without logging the
// event. Persists to payment_events (per-payment log), mirrors the money-moving
// ones onto the integration event bus + audit_logs (financial audit).
// =============================================================================

const BUS_MIRROR: Partial<Record<PaymentEventType, "PaymentCompleted">> = {
  PaymentApproved: "PaymentCompleted",
};

export async function emitPaymentEvent(params: {
  restaurantId: string;
  paymentId: string | null;
  type: PaymentEventType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const db = tenantDb(params.restaurantId);
  await db.insert("payment_events", {
    payment_id: params.paymentId,
    type: params.type,
    payload: (params.payload ?? {}) as Json,
  });
  // Financial audit.
  await db.insert("audit_logs", {
    user_id: null,
    action: `payment.${params.type}`,
    entity_type: "payment",
    entity_id: params.paymentId,
    metadata: (params.payload ?? {}) as Json,
  });
  // Mirror money-confirming events onto the integration bus for automations/AI.
  const mirror = BUS_MIRROR[params.type];
  if (mirror)
    await emitEvent({
      restaurantId: params.restaurantId,
      type: mirror,
      source: "mercadopago",
      payload: { paymentId: params.paymentId, ...(params.payload ?? {}) },
    });
}
