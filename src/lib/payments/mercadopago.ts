import "server-only";

import { randomUUID } from "node:crypto";

import {
  mapMercadoPagoStatus,
  type CreatePaymentInput,
  type PaymentProvider,
  type ProviderHealth,
  type ProviderIntent,
  type ProviderPayment,
  type WebhookParseResult,
} from "./types";

// =============================================================================
// MercadoPagoAdapter — the first PaymentProvider. With MP_ACCESS_TOKEN set it
// calls the real Mercado Pago API; without it, sandbox-simulates every call so
// the whole checkout + webhook + retry flow is buildable and testable before
// real credentials exist. Money confirmation only ever comes from the webhook.
// =============================================================================

const MP_API = "https://api.mercadopago.com";

export class MercadoPagoAdapter implements PaymentProvider {
  readonly name = "mercadopago";
  readonly configured: boolean;
  readonly sandbox: boolean;
  private readonly token: string | null;

  constructor() {
    this.token = process.env.MP_ACCESS_TOKEN ?? null;
    this.configured = !!this.token;
    // Sandbox unless a real token is present (test tokens start with TEST-).
    this.sandbox = !this.token || this.token.startsWith("TEST-");
  }

  async createPayment(input: CreatePaymentInput): Promise<ProviderIntent> {
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    if (!this.token) {
      // Sandbox: checkout is our own simulator page (no real MP).
      return {
        ok: true,
        preferenceId: `sandbox_pref_${randomUUID()}`,
        checkoutUrl: `${baseFrom(input.returnUrl)}/pay/${input.externalReference}`,
        expiresAt,
      };
    }
    try {
      const res = await fetch(`${MP_API}/checkout/preferences`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ title: input.description, quantity: 1, unit_price: input.amount, currency_id: input.currency }],
          external_reference: input.externalReference,
          back_urls: { success: input.returnUrl, failure: input.returnUrl, pending: input.returnUrl },
          auto_return: "approved",
          notification_url: input.notificationUrl,
          expires: true,
          expiration_date_to: expiresAt,
        }),
      });
      const data = (await res.json()) as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
      if (!res.ok) return { ok: false, preferenceId: null, checkoutUrl: null, expiresAt: null, error: data.message };
      return {
        ok: true,
        preferenceId: data.id ?? null,
        checkoutUrl: (this.sandbox ? data.sandbox_init_point : data.init_point) ?? data.init_point ?? null,
        expiresAt,
      };
    } catch (e) {
      return { ok: false, preferenceId: null, checkoutUrl: null, expiresAt: null, error: (e as Error).message };
    }
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPayment | null> {
    if (!this.token) return null; // sandbox: state lives in our DB
    try {
      const res = await fetch(`${MP_API}/v1/payments/${providerPaymentId}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return null;
      const d = (await res.json()) as {
        id: number;
        status: string;
        status_detail?: string;
        external_reference?: string;
        payment_method_id?: string;
      };
      return {
        providerPaymentId: String(d.id),
        status: mapMercadoPagoStatus(d.status),
        method: d.payment_method_id ?? null,
        externalReference: d.external_reference ?? null,
        failureReason: d.status === "rejected" ? d.status_detail ?? "rejected" : null,
      };
    } catch {
      return null;
    }
  }

  async cancelPayment(providerPaymentId: string): Promise<void> {
    if (!this.token) return;
    await fetch(`${MP_API}/v1/payments/${providerPaymentId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {});
  }

  async refundPayment(providerPaymentId: string): Promise<ProviderPayment> {
    if (!this.token)
      return { providerPaymentId, status: "refunded", method: null, externalReference: null, failureReason: null };
    await fetch(`${MP_API}/v1/payments/${providerPaymentId}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
    return { providerPaymentId, status: "refunded", method: null, externalReference: null, failureReason: null };
  }

  /**
   * Parse a webhook. Sandbox payloads carry the full state inline; real MP
   * payloads carry only the id, so we re-query the payment (status of truth).
   */
  async webhook(payload: unknown): Promise<WebhookParseResult> {
    const p = (payload ?? {}) as {
      type?: string;
      action?: string;
      data?: { id?: string; status?: string; external_reference?: string; method?: string };
    };
    const id = p.data?.id;
    if (!id) return { ok: false, message: "Webhook sin payment id" };

    // Sandbox simulator includes status inline.
    if (!this.token && p.data?.status) {
      return {
        ok: true,
        providerPaymentId: id,
        status: mapMercadoPagoStatus(p.data.status),
        method: p.data.method ?? "sandbox",
        externalReference: p.data.external_reference ?? null,
        failureReason: p.data.status === "rejected" ? "cc_rejected" : null,
        message: "Webhook sandbox procesado",
      };
    }

    const fetched = await this.getPayment(id);
    if (!fetched) return { ok: false, providerPaymentId: id, message: "No se pudo consultar el pago" };
    return {
      ok: true,
      providerPaymentId: fetched.providerPaymentId,
      status: fetched.status,
      method: fetched.method,
      externalReference: fetched.externalReference,
      failureReason: fetched.failureReason,
      message: "Webhook procesado",
    };
  }

  async health(): Promise<ProviderHealth> {
    const t0 = Date.now();
    if (!this.token)
      return { ok: true, latencyMs: 0, message: "Sandbox: sin credenciales reales (simulado)." };
    try {
      const res = await fetch(`${MP_API}/v1/payment_methods`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return { ok: res.ok, latencyMs: Date.now() - t0, message: res.ok ? "Conectado" : `Error ${res.status}` };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, message: (e as Error).message };
    }
  }
}

function baseFrom(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "";
  }
}

/** Factory: the Core asks for "the payment provider", never for Mercado Pago. */
export function getPaymentProvider(): PaymentProvider {
  return new MercadoPagoAdapter();
}
