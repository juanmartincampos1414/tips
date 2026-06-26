// =============================================================================
// Payments — gateway-agnostic types. The Core depends ONLY on PaymentProvider;
// Mercado Pago (or Stripe/Adyen later) is just an adapter. Confirmation of money
// ALWAYS comes from the webhook, never the checkout redirect.
// =============================================================================

export type PaymentStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "refunded"
  | "chargeback";

export type TipSource = "nfc" | "qr" | "campaign" | "manual" | "hotel" | "room_service";
export type BusinessUnit = "restaurant" | "hotel" | "bar" | "beach_club" | "spa";

export type PaymentEventType =
  | "PaymentCreated"
  | "CheckoutStarted"
  | "PaymentApproved"
  | "PaymentRejected"
  | "PaymentCancelled"
  | "PaymentExpired"
  | "RefundIssued"
  | "ChargebackCreated"
  | "WebhookReceived";

export type CreatePaymentInput = {
  amount: number;
  currency: string;
  externalReference: string;
  description: string;
  /** Where the guest returns after checkout (our app). */
  returnUrl: string;
  /** Where the provider sends webhooks. */
  notificationUrl: string;
};

/** The intent the provider hands back to start a checkout. */
export type ProviderIntent = {
  ok: boolean;
  preferenceId: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  error?: string;
};

/** A payment's state as the provider reports it (status already normalized). */
export type ProviderPayment = {
  providerPaymentId: string;
  status: PaymentStatus;
  method: string | null;
  externalReference: string | null;
  failureReason: string | null;
};

export type WebhookParseResult = {
  ok: boolean;
  providerPaymentId?: string;
  status?: PaymentStatus;
  method?: string | null;
  externalReference?: string | null;
  failureReason?: string | null;
  message: string;
};

export type ProviderHealth = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

// ---------------------------------------------------------------------------
// The contract every payment gateway implements. The Core never sees Mercado
// Pago — only this.
// ---------------------------------------------------------------------------
export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;
  readonly sandbox: boolean;
  createPayment(input: CreatePaymentInput): Promise<ProviderIntent>;
  getPayment(providerPaymentId: string): Promise<ProviderPayment | null>;
  cancelPayment(providerPaymentId: string): Promise<void>;
  refundPayment(providerPaymentId: string): Promise<ProviderPayment>;
  webhook(payload: unknown): Promise<WebhookParseResult>;
  health(): Promise<ProviderHealth>;
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
  chargeback: "Contracargo",
};

export const TIP_SOURCE_LABEL: Record<TipSource, string> = {
  nfc: "NFC",
  qr: "QR",
  campaign: "Campaña",
  manual: "Manual",
  hotel: "Hotel",
  room_service: "Room service",
};

/** Map a raw Mercado Pago status string to our canonical status. */
export function mapMercadoPagoStatus(mp: string): PaymentStatus {
  switch (mp) {
    case "approved":
    case "authorized":
      return "approved";
    case "in_process":
    case "in_mediation":
    case "pending":
      return mp === "pending" ? "pending" : "processing";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "charged_back":
      return "chargeback";
    default:
      return "pending";
  }
}
