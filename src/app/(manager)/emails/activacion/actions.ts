"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/lib/auth";
import { applyEmailEvent } from "@/lib/email/webhook";
import { retryEmail } from "@/lib/email/send";
import { tenantDb } from "@/lib/tenant/db";
import type { EmailEventType } from "@/lib/database.types";

const VALID_EVENTS: EmailEventType[] = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
];

function str(fd: FormData, k: string) {
  return ((fd.get(k) as string | null) ?? "").trim();
}

/**
 * Testing utility: create a fake "sent" email_log (with a synthetic provider
 * message id) so simulated tracking events have a target — without a real
 * Resend send.
 */
export async function createTestLog(formData: FormData): Promise<void> {
  const member = await requireManager();
  const to = str(formData, "to") || "test@tips.local";
  await tenantDb(member.restaurantId).insert("email_logs", {
    recipient_email: to,
    subject: "Test de tracking · Tips",
    status: "sent",
    provider_message_id: `test_${randomUUID()}`,
    sent_at: new Date().toISOString(),
  });
  revalidatePath("/emails/activacion");
}

/**
 * Testing utility: fire a simulated provider event against an email_log,
 * running the exact same pipeline the live webhook uses.
 */
export async function simulateEvent(formData: FormData): Promise<void> {
  const member = await requireManager();
  const logId = str(formData, "log_id");
  const event = str(formData, "event") as EmailEventType;
  if (!logId || !VALID_EVENTS.includes(event)) return;

  const { data: log } = (await tenantDb(member.restaurantId)
    .select("email_logs", "id, guest_id")
    .eq("id", logId)
    .maybeSingle()) as { data: { id: string; guest_id: string | null } | null };
  if (!log) return;

  await applyEmailEvent(member.restaurantId, log, event, { simulated: true, by: member.userId });
  revalidatePath("/emails/activacion");
}

export async function retryEmailAction(formData: FormData): Promise<void> {
  const member = await requireManager();
  const logId = str(formData, "log_id");
  if (!logId) return;
  await retryEmail(member.restaurantId, logId);
  revalidatePath("/emails/activacion");
}
