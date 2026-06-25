import { SandboxAdapter } from "./adapters/sandbox";
import {
  NO_CAPABILITIES,
  type AdapterMeta,
  type AdapterMode,
  type Capabilities,
  type IntegrationAdapter,
  type IntegrationCategory,
} from "./types";

// =============================================================================
// Provider Registry — the catalog of every provider the platform is prepared
// for. Adding a real integration = add its Adapter and point its entry at it;
// until then every provider resolves to a SandboxAdapter. The Core reads
// capabilities from here to light up features — it never hard-codes a provider.
// =============================================================================

const caps = (partial: Partial<Capabilities>): Capabilities => ({
  ...NO_CAPABILITIES,
  ...partial,
});

export type ProviderDef = AdapterMeta;

export const PROVIDERS: ProviderDef[] = [
  // ---- POS ----
  def("fudo", "Fudo", "pos", "POS gastronómico (AR/LatAm).", caps({ supportsGuests: true, supportsOrders: true, supportsPayments: true })),
  def("tango", "Tango", "pos", "Gestión y facturación.", caps({ supportsGuests: true, supportsOrders: true })),
  def("resto", "Restó", "pos", "POS para restaurantes.", caps({ supportsGuests: true, supportsOrders: true })),
  def("toast", "Toast", "pos", "Restaurant POS (US).", caps({ supportsGuests: true, supportsOrders: true, supportsPayments: true })),
  def("lightspeed", "Lightspeed", "pos", "Retail & hospitality POS.", caps({ supportsGuests: true, supportsOrders: true })),
  // ---- PMS ----
  def("opera", "Opera", "pms", "Oracle Hospitality PMS.", caps({ supportsGuests: true, supportsReservations: true })),
  def("cloudbeds", "Cloudbeds", "pms", "Hotel PMS + channel manager.", caps({ supportsGuests: true, supportsReservations: true })),
  def("mews", "Mews", "pms", "Cloud-native PMS.", caps({ supportsGuests: true, supportsReservations: true })),
  def("apaleo", "Apaleo", "pms", "API-first PMS.", caps({ supportsGuests: true, supportsReservations: true })),
  // ---- Reservations ----
  def("maitre", "Maitre", "reservations", "Reservas y gestión de salón.", caps({ supportsGuests: true, supportsReservations: true })),
  def("sevenrooms", "SevenRooms", "reservations", "Guest experience & reservations.", caps({ supportsGuests: true, supportsReservations: true })),
  def("covermanager", "CoverManager", "reservations", "Reservas (ES/LatAm).", caps({ supportsGuests: true, supportsReservations: true })),
  def("opentable", "OpenTable", "reservations", "Red global de reservas.", caps({ supportsGuests: true, supportsReservations: true })),
  // ---- Payments ----
  def("mercadopago", "Mercado Pago", "payments", "Pagos (AR/LatAm).", caps({ supportsPayments: true })),
  def("stripe", "Stripe", "payments", "Pagos globales.", caps({ supportsPayments: true })),
  def("adyen", "Adyen", "payments", "Pagos enterprise.", caps({ supportsPayments: true })),
  // ---- Email / WhatsApp / Marketing ----
  def("resend", "Resend", "email", "Email transaccional + tracking.", caps({ supportsCampaigns: true })),
  def("meta", "Meta WhatsApp", "whatsapp", "WhatsApp Business Cloud API.", caps({ supportsCampaigns: true })),
  def("twilio", "Twilio", "marketing", "SMS / WhatsApp / voz.", caps({ supportsCampaigns: true })),
  // ---- CRM ----
  def("hubspot", "HubSpot", "crm", "CRM & marketing.", caps({ supportsGuests: true, supportsCampaigns: true, supportsLoyalty: true })),
  def("salesforce", "Salesforce", "crm", "CRM enterprise.", caps({ supportsGuests: true, supportsCampaigns: true })),
  // ---- Analytics ----
  def("looker", "Looker", "analytics", "BI & dashboards.", caps({})),
  def("metabase", "Metabase", "analytics", "BI open-source.", caps({})),
  // ---- Wallet ----
  def("apple_wallet", "Apple Wallet", "wallet", "Passes en Apple Wallet.", caps({ supportsWallet: true })),
  def("google_wallet", "Google Wallet", "wallet", "Passes en Google Wallet.", caps({ supportsWallet: true })),
];

function def(
  id: string,
  name: string,
  category: IntegrationCategory,
  description: string,
  capabilities: Capabilities,
): ProviderDef {
  return { id, name, category, description, capabilities };
}

const byId = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string): ProviderDef | undefined {
  return byId.get(id);
}

/**
 * Resolve the adapter for a provider. Real adapters plug in here per id; every
 * unimplemented provider falls back to the SandboxAdapter — same contract.
 */
export function getAdapter(
  id: string,
  mode: AdapterMode = "sandbox",
): IntegrationAdapter | null {
  const meta = byId.get(id);
  if (!meta) return null;
  // When a real adapter exists: `if (id === "resend" && mode === "production")
  // return new ResendAdapter(meta);` — until then, sandbox for everyone.
  void mode;
  return new SandboxAdapter(meta);
}

export function providersByCategory(): Map<IntegrationCategory, ProviderDef[]> {
  const m = new Map<IntegrationCategory, ProviderDef[]>();
  for (const p of PROVIDERS) {
    if (!m.has(p.category)) m.set(p.category, []);
    m.get(p.category)!.push(p);
  }
  return m;
}
