import { NextResponse, type NextRequest } from "next/server";

import { emitEvent } from "@/lib/integrations/events";
import { getAdapter, getProvider } from "@/lib/integrations/registry";
import { resolveConnectionByProvider } from "@/lib/tenant/resolve";

// =============================================================================
// Webhook Manager — every provider's webhooks enter through ONE architecture:
// /api/webhooks/<provider>. The path resolves the provider, its Adapter verifies
// + processes its own payload (sandbox simulates), and the result is recorded on
// the bus (WebhookReceived / WebhookInvalid). Provider-specific real routes
// (e.g. /api/webhooks/resend) take precedence over this dynamic handler.
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const def = getProvider(provider);
  if (!def) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  const adapter = getAdapter(provider);
  if (!adapter) return NextResponse.json({ error: "No adapter" }, { status: 404 });

  const payload = await req.json().catch(() => ({}));

  // Resolve the restaurant from a connection for this provider. PLACEHOLDER (see
  // resolveConnectionByProvider): valid only for sandbox/generic providers until
  // a real adapter maps the payload/secret/signature → a specific tenant.
  const conn = await resolveConnectionByProvider(provider);

  const result = await adapter.handleWebhook(payload);

  if (conn)
    await emitEvent({
      restaurantId: conn.restaurant_id,
      type: result.ok ? "WebhookReceived" : "WebhookInvalid",
      source: provider,
      payload: { message: result.message },
    });

  return NextResponse.json({ ok: result.ok, message: result.message });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const def = getProvider(provider);
  return NextResponse.json({
    status: "ok",
    provider,
    known: !!def,
    category: def?.category ?? null,
  });
}
