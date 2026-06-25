import type {
  AdapterMeta,
  ConnectionTest,
  IntegrationAdapter,
  SyncDirection,
  SyncResult,
  WebhookResult,
} from "../types";

// =============================================================================
// SandboxAdapter — the default implementation every provider uses until a real
// Adapter is written. It NEVER calls an external API or touches real credentials:
// it simulates connection tests, sync runs (random-ish row counts) and webhook
// verification. This lets a full integration be built + demoed end-to-end before
// the provider grants access. A real adapter swaps in by implementing the same
// IntegrationAdapter contract — no Core changes.
// =============================================================================

export class SandboxAdapter implements IntegrationAdapter {
  readonly mode = "sandbox" as const;
  constructor(readonly meta: AdapterMeta) {}

  async testConnection(): Promise<ConnectionTest> {
    // Validate (simulated): status + credentials + connectivity all OK in sandbox.
    return {
      ok: true,
      message: `Sandbox de ${this.meta.name}: conexión simulada OK (sin credenciales reales).`,
    };
  }

  async sync(direction: SyncDirection): Promise<SyncResult> {
    // Simulate processing a batch of records for whatever this provider supports.
    const caps = this.meta.capabilities;
    const base =
      (caps.supportsGuests ? 40 : 0) +
      (caps.supportsOrders ? 25 : 0) +
      (caps.supportsReservations ? 15 : 0) +
      (caps.supportsPayments ? 10 : 0);
    const rowsProcessed = base + Math.floor(Math.random() * 20);
    void direction;
    return { ok: true, rowsProcessed };
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    // Sandbox accepts a simulated payload as if signature-verified.
    void payload;
    return { ok: true, message: `Webhook simulado de ${this.meta.name} procesado.` };
  }
}
