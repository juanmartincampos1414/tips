import "server-only";

import crypto from "node:crypto";

import { tenantDb } from "@/lib/tenant/db";
import type {
  CampaignRecipientStatus,
  EmailEventType,
  Json,
} from "@/lib/database.types";

// -----------------------------------------------------------------------------
// Resend webhook signature (Svix scheme). Header set: svix-id, svix-timestamp,
// svix-signature ("v1,<base64>" space-separated). Secret is "whsec_<base64>".
// Verified over `${id}.${timestamp}.${rawBody}` with HMAC-SHA256.
// -----------------------------------------------------------------------------
export function verifySvixSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature)
    return false;
  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(key, "base64");
  } catch {
    return false;
  }
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // The header may carry multiple space-separated `v1,<sig>` versions.
  const expectedBuf = Buffer.from(expected);
  return headers.signature
    .split(" ")
    .map((p) => (p.includes(",") ? p.split(",")[1] : p))
    .some((sig) => {
      const sigBuf = Buffer.from(sig);
      return (
        sigBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(sigBuf, expectedBuf)
      );
    });
}

/** Map a Resend event type to our email_events vocabulary (null = ignore). */
export function mapResendEvent(type: string): EmailEventType | null {
  switch (type) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    default:
      return null; // delivery_delayed, scheduled, etc. — ignored
  }
}

const RECIPIENT_RANK: Record<string, number> = {
  pending: 0,
  delivered: 1,
  opened: 2,
  clicked: 3,
};

export type EmailLogRef = {
  id: string;
  guest_id: string | null;
};

/**
 * Apply one email event: record it, advance the email_log + campaign_recipient
 * lifecycle, and suppress the guest on a hard bounce / complaint. Shared by the
 * live webhook and the testing utility so both exercise the exact same path.
 *
 * `restaurantId` scopes every write; `log` MUST have been resolved within that
 * tenant (the Resend webhook resolves it via resolveEmailLogByProviderId; the
 * simulator reads it scoped). campaign_recipients is reached by its
 * tenant-unique email_log_id via childMatch/childUpdate.
 */
export async function applyEmailEvent(
  restaurantId: string,
  log: EmailLogRef,
  eventType: EmailEventType,
  raw?: Json,
): Promise<void> {
  const db = tenantDb(restaurantId);

  await db.insert("email_events", {
    guest_id: log.guest_id,
    email_log_id: log.id,
    event_type: eventType,
    metadata: raw ?? null,
  });

  const isFailure = eventType === "bounced" || eventType === "complained";
  const now = new Date().toISOString();

  // email_logs: a bounce/complaint marks the send failed; delivery/open/click
  // never downgrade a 'sent' log.
  if (isFailure)
    await db
      .update("email_logs", { status: "failed", error_message: `Resend: ${eventType}` })
      .eq("id", log.id);

  // campaign_recipients linked to this log: escalate status + stamp timestamps.
  // CHILD reached by its tenant-unique email_log_id (derived from the scoped log).
  const { data: recs } = (await db.childMatch(
    "campaign_recipients",
    { email_log_id: log.id },
    "id, status",
  )) as { data: { id: string; status: string }[] | null };
  for (const r of recs ?? []) {
    const patch: {
      status?: CampaignRecipientStatus;
      reason?: string;
      delivered_at?: string;
      opened_at?: string;
      clicked_at?: string;
    } = {};
    if (isFailure) {
      patch.status = "failed";
      patch.reason = `Resend: ${eventType}`;
    } else {
      const current = RECIPIENT_RANK[r.status] ?? -1;
      const next = RECIPIENT_RANK[eventType] ?? -1;
      if (next > current) patch.status = eventType as CampaignRecipientStatus;
      if (eventType === "delivered") patch.delivered_at = now;
      if (eventType === "opened") patch.opened_at = now;
      if (eventType === "clicked") patch.clicked_at = now;
    }
    if (Object.keys(patch).length)
      await db.childUpdate("campaign_recipients", { id: r.id }, patch);
  }

  // Suppression: stop emailing a guest that bounced or complained.
  if (isFailure && log.guest_id)
    await db.update("guests", { marketing_consent: false }).eq("id", log.guest_id);
}
