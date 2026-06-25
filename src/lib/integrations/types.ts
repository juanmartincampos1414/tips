// =============================================================================
// Integration Platform — decoupled types & provider interfaces.
//
// The Core NEVER imports a concrete provider. It depends only on these
// interfaces + capabilities, so a new POS/PMS/CRM/etc. is added by writing one
// Adapter — no changes to CRM / Rewards / Wallet / Recognition / Campaigns.
// Hospitality-agnostic: works for restaurants, hotels, beach clubs, spas, …
// =============================================================================

export type IntegrationCategory =
  | "pos"
  | "pms"
  | "reservations"
  | "crm"
  | "payments"
  | "marketing"
  | "email"
  | "whatsapp"
  | "wallet"
  | "identity"
  | "analytics";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "needs_configuration"
  | "sync_error"
  | "disabled";

export type SyncDirection = "inbound" | "outbound";
export type SyncStatus = "pending" | "running" | "completed" | "failed";
export type AdapterMode = "sandbox" | "production";

// ---------------------------------------------------------------------------
// Capabilities — each adapter declares what it can do; the Core lights up
// features automatically from these flags.
// ---------------------------------------------------------------------------
export type Capabilities = {
  supportsGuests: boolean;
  supportsOrders: boolean;
  supportsReservations: boolean;
  supportsPayments: boolean;
  supportsReviews: boolean;
  supportsRewards: boolean;
  supportsWallet: boolean;
  supportsCampaigns: boolean;
  supportsLoyalty: boolean;
};

export const NO_CAPABILITIES: Capabilities = {
  supportsGuests: false,
  supportsOrders: false,
  supportsReservations: false,
  supportsPayments: false,
  supportsReviews: false,
  supportsRewards: false,
  supportsWallet: false,
  supportsCampaigns: false,
  supportsLoyalty: false,
};

// ---------------------------------------------------------------------------
// Event Bus — every relevant change emits one of these. Future automations / AI
// subscribe; today they're persisted to integration_events + audit_logs.
// ---------------------------------------------------------------------------
export type IntegrationEventType =
  | "GuestCreated"
  | "GuestUpdated"
  | "GuestImported"
  | "RecognitionCreated"
  | "ReviewCreated"
  | "RewardIssued"
  | "RewardClaimed"
  | "ReturnVisit"
  | "CampaignSent"
  | "EmailDelivered"
  | "PaymentCompleted"
  | "ReservationCreated"
  | "ReservationCheckedIn"
  | "WalletIssued"
  | "WalletRedeemed"
  | "ConnectionConnected"
  | "ConnectionDisconnected"
  | "SyncStarted"
  | "SyncCompleted"
  | "SyncFailed"
  | "WebhookReceived"
  | "WebhookInvalid";

// ---------------------------------------------------------------------------
// External-facing domain shapes (provider-agnostic). The Mapper translates each
// provider's raw fields into these before anything reaches the Core.
// ---------------------------------------------------------------------------
export type ExternalGuest = {
  externalId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tags?: string[];
  raw?: unknown;
};
export type ExternalOrder = { externalId: string; total: number | null; guestId?: string | null; raw?: unknown };
export type ExternalReservation = {
  externalId: string;
  guestName: string | null;
  partySize: number | null;
  at: string | null;
  status: string | null;
  raw?: unknown;
};
export type ExternalPayment = { externalId: string; amount: number | null; status: string | null; raw?: unknown };

export type SyncResult = {
  ok: boolean;
  rowsProcessed: number;
  error?: string;
};

export type ConnectionTest = {
  ok: boolean;
  message: string;
};

export type WebhookResult = {
  ok: boolean;
  eventType?: IntegrationEventType;
  message: string;
};

// ---------------------------------------------------------------------------
// Provider interfaces — decoupled per category. An adapter implements exactly
// the interfaces its capabilities declare (all optional on the base adapter).
// ---------------------------------------------------------------------------
export interface POSProvider {
  getMenu(): Promise<unknown[]>;
  getOrders(): Promise<ExternalOrder[]>;
  getTables(): Promise<unknown[]>;
  getPayments(): Promise<ExternalPayment[]>;
  getStaff(): Promise<unknown[]>;
  getGuests(): Promise<ExternalGuest[]>;
}

export interface PMSProvider {
  getReservations(): Promise<ExternalReservation[]>;
  getGuests(): Promise<ExternalGuest[]>;
  getRooms(): Promise<unknown[]>;
  checkIn(reservationId: string): Promise<void>;
  checkOut(reservationId: string): Promise<void>;
}

export interface ReservationProvider {
  getBookings(): Promise<ExternalReservation[]>;
  createBooking(input: Partial<ExternalReservation>): Promise<ExternalReservation>;
  cancelBooking(id: string): Promise<void>;
  updateBooking(id: string, input: Partial<ExternalReservation>): Promise<ExternalReservation>;
}

export interface CRMProvider {
  getGuests(): Promise<ExternalGuest[]>;
  createGuest(input: Partial<ExternalGuest>): Promise<ExternalGuest>;
  updateGuest(id: string, input: Partial<ExternalGuest>): Promise<ExternalGuest>;
  deleteGuest(id: string): Promise<void>;
  getTags(): Promise<string[]>;
}

export interface PaymentProvider {
  createPayment(input: { amount: number; guestId?: string }): Promise<ExternalPayment>;
  refundPayment(id: string): Promise<ExternalPayment>;
  getPayment(id: string): Promise<ExternalPayment | null>;
  webhook(payload: unknown): Promise<WebhookResult>;
}

export interface MessagingProvider {
  send(input: { to: string; subject?: string; body: string }): Promise<{ ok: boolean; id?: string }>;
  webhook(payload: unknown): Promise<WebhookResult>;
  health(): Promise<ConnectionTest>;
}

export interface WalletProvider {
  issuePass(input: { guestId: string }): Promise<{ ok: boolean; passId?: string }>;
  revokePass(passId: string): Promise<void>;
  updatePass(passId: string, input: unknown): Promise<void>;
  validatePass(passId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// The Adapter contract every provider implements. The Core only ever sees this.
// ---------------------------------------------------------------------------
export type AdapterMeta = {
  id: string; // provider id, e.g. "fudo"
  name: string;
  category: IntegrationCategory;
  description: string;
  capabilities: Capabilities;
};

export interface IntegrationAdapter {
  readonly meta: AdapterMeta;
  readonly mode: AdapterMode;
  /** Validate status + credentials + connectivity before any sync. */
  testConnection(): Promise<ConnectionTest>;
  /** Pull (inbound) or push (outbound) data. Sandbox simulates. */
  sync(direction: SyncDirection): Promise<SyncResult>;
  /** Process a provider webhook payload (sandbox simulates verification). */
  handleWebhook(payload: unknown): Promise<WebhookResult>;
}

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  pos: "POS",
  pms: "PMS",
  reservations: "Reservas",
  crm: "CRM",
  payments: "Pagos",
  marketing: "Marketing",
  email: "Email",
  whatsapp: "WhatsApp",
  wallet: "Wallet",
  identity: "Identidad",
  analytics: "Analytics",
};

export const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  needs_configuration: "Falta configurar",
  sync_error: "Error de sync",
  disabled: "Deshabilitado",
};
