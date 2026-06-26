import { NextResponse, type NextRequest } from "next/server";

import { handlePaymentWebhook } from "@/lib/payments/service";

// =============================================================================
// Mercado Pago webhook — enters through the unified Webhook Manager path. The
// ONLY source of truth for money: validate → register → emit event → update
// Payment → confirm Recognition (all inside handlePaymentWebhook, never here).
// MP delivers either query params (?type=payment&data.id=) or a JSON body.
// =============================================================================

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Normalize both delivery shapes into { type, data: { id, ... } }.
  const qpType = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const qpId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const payload = {
    type: (body.type as string) ?? qpType ?? "payment",
    action: body.action,
    data: (body.data as Record<string, unknown>) ?? (qpId ? { id: qpId } : {}),
  };

  const result = await handlePaymentWebhook(payload);
  // Always 200 so the provider doesn't hammer retries on our app-level outcomes.
  return NextResponse.json({ ok: result.ok, message: result.message });
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "mercadopago" });
}
