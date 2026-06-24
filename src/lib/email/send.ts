import "server-only";

import { logAudit } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailLogStatus } from "@/lib/database.types";

import { EMAIL_NOT_CONFIGURED, getEmailProvider } from "./provider";

type Admin = ReturnType<typeof createAdminClient>;

export type SendOutcome = {
  status: EmailLogStatus;
  logId: string | null;
  error?: string;
  providerConfigured: boolean;
};

type EmailSettings = {
  sender_name: string | null;
  sender_email: string | null;
  reply_to_email: string | null;
  email_enabled: boolean;
};

async function loadSettings(
  supabase: Admin,
  restaurantId: string,
): Promise<EmailSettings> {
  const { data } = await supabase
    .from("restaurant_settings")
    .select("sender_name, sender_email, reply_to_email, email_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return {
    sender_name: data?.sender_name ?? null,
    sender_email: data?.sender_email ?? null,
    reply_to_email: data?.reply_to_email ?? null,
    email_enabled: data?.email_enabled ?? false,
  };
}

/** Write the per-send log row (the comms audit trail). */
async function createLog(
  supabase: Admin,
  row: {
    restaurantId: string;
    guestId: string | null;
    templateId: string | null;
    to: string;
    subject: string;
  },
): Promise<string | null> {
  const { data } = await supabase
    .from("email_logs")
    .insert({
      restaurant_id: row.restaurantId,
      guest_id: row.guestId,
      template_id: row.templateId,
      recipient_email: row.to,
      subject: row.subject,
      status: "pending",
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

async function finalize(
  supabase: Admin,
  logId: string | null,
  patch: {
    status: EmailLogStatus;
    provider_message_id?: string | null;
    error_message?: string | null;
  },
) {
  if (!logId) return;
  await supabase
    .from("email_logs")
    .update({
      status: patch.status,
      provider_message_id: patch.provider_message_id ?? null,
      error_message: patch.error_message ?? null,
      sent_at: patch.status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", logId);
}

/**
 * Core dispatch: log → guard against missing provider/sender → send → finalize
 * + emit the `sent` lifecycle event. Never throws; always returns an outcome.
 */
async function dispatch(
  supabase: Admin,
  params: {
    restaurantId: string;
    guestId: string | null;
    templateId: string | null;
    to: string;
    subject: string;
    html: string;
    settings: EmailSettings;
  },
): Promise<SendOutcome> {
  const provider = getEmailProvider();
  const logId = await createLog(supabase, {
    restaurantId: params.restaurantId,
    guestId: params.guestId,
    templateId: params.templateId,
    to: params.to,
    subject: params.subject,
  });

  // No provider key → stay in mock/disabled mode, don't fail loudly.
  if (!provider.configured) {
    await finalize(supabase, logId, { status: "skipped", error_message: EMAIL_NOT_CONFIGURED });
    return { status: "skipped", logId, error: EMAIL_NOT_CONFIGURED, providerConfigured: false };
  }
  if (!params.settings.sender_email) {
    const error = "Falta configurar el remitente (sender_email).";
    await finalize(supabase, logId, { status: "skipped", error_message: error });
    return { status: "skipped", logId, error, providerConfigured: true };
  }

  const from = params.settings.sender_name
    ? `${params.settings.sender_name} <${params.settings.sender_email}>`
    : params.settings.sender_email;

  // In-flight: pending → processing (lifecycle is observable even mid-send).
  if (logId)
    await supabase
      .from("email_logs")
      .update({ status: "processing", last_attempt_at: new Date().toISOString() })
      .eq("id", logId);

  const result = await provider.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.settings.reply_to_email,
  });

  if (result.ok) {
    await finalize(supabase, logId, {
      status: "sent",
      provider_message_id: result.messageId ?? null,
    });
    if (logId)
      await supabase.from("email_events").insert({
        restaurant_id: params.restaurantId,
        guest_id: params.guestId,
        email_log_id: logId,
        event_type: "sent",
      });
    return { status: "sent", logId, providerConfigured: true };
  }

  await finalize(supabase, logId, { status: "failed", error_message: result.error });
  return { status: "failed", logId, error: result.error, providerConfigured: true };
}

export type GuestForEmail = {
  id: string;
  email: string | null;
  marketing_consent: boolean;
};

/**
 * Contactability Guard — refuse the send (status `skipped`, no provider call)
 * when the guest has no email, hasn't consented, or email is disabled.
 */
export async function sendGuestEmail(params: {
  restaurantId: string;
  userId: string;
  guest: GuestForEmail;
  subject: string;
  html: string;
  templateId?: string | null;
}): Promise<SendOutcome> {
  const supabase = createAdminClient();
  const settings = await loadSettings(supabase, params.restaurantId);

  let block: string | null = null;
  if (!settings.email_enabled) block = "Email deshabilitado para el restaurante.";
  else if (!params.guest.email) block = "El cliente no tiene email.";
  else if (!params.guest.marketing_consent) block = "El cliente no dio consentimiento.";

  if (block) {
    const logId = await createLog(supabase, {
      restaurantId: params.restaurantId,
      guestId: params.guest.id,
      templateId: params.templateId ?? null,
      to: params.guest.email ?? "—",
      subject: params.subject,
    });
    await finalize(supabase, logId, { status: "skipped", error_message: block });
    return { status: "skipped", logId, error: block, providerConfigured: getEmailProvider().configured };
  }

  return dispatch(supabase, {
    restaurantId: params.restaurantId,
    guestId: params.guest.id,
    templateId: params.templateId ?? null,
    to: params.guest.email!,
    subject: params.subject,
    html: params.html,
    settings,
  });
}

/**
 * Test Send — a deliberate diagnostic to the owner's own inbox. Bypasses the
 * consent guard (it's the owner testing their own setup) but still respects the
 * provider/sender configuration and records everything.
 */
export async function sendTestEmail(params: {
  restaurantId: string;
  userId: string;
  to: string;
  subject: string;
  html: string;
}): Promise<SendOutcome> {
  const supabase = createAdminClient();
  const settings = await loadSettings(supabase, params.restaurantId);

  const outcome = await dispatch(supabase, {
    restaurantId: params.restaurantId,
    guestId: null,
    templateId: null,
    to: params.to,
    subject: params.subject,
    html: params.html,
    settings,
  });

  await logAudit({
    restaurantId: params.restaurantId,
    userId: params.userId,
    action: outcome.status === "failed" ? "email.failed" : "email.test_sent",
    entityType: "email_log",
    entityId: outcome.logId ?? undefined,
    metadata: { to: params.to, status: outcome.status, provider: getEmailProvider().name },
  });

  return outcome;
}

/**
 * Retry a failed send on the SAME email_log (lifecycle: failed → processing →
 * sent | failed, retry_count++). Re-resolves the body from the template; logs
 * without a template can't be retried (no stored body).
 */
export async function retryEmail(
  restaurantId: string,
  logId: string,
): Promise<SendOutcome> {
  const supabase = createAdminClient();
  const { data: log } = await supabase
    .from("email_logs")
    .select("id, recipient_email, subject, template_id, status, retry_count, guest_id")
    .eq("id", logId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!log) return { status: "failed", logId: null, error: "Log inexistente", providerConfigured: false };
  if (log.status !== "failed")
    return { status: log.status, logId, error: "Sólo se reintentan envíos fallidos.", providerConfigured: true };
  if (!log.template_id)
    return { status: "failed", logId, error: "Sin plantilla: no hay cuerpo para reintentar.", providerConfigured: true };

  const settings = await loadSettings(supabase, restaurantId);
  const provider = getEmailProvider();
  const { data: tpl } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("id", log.template_id)
    .maybeSingle();

  await supabase
    .from("email_logs")
    .update({
      status: "processing",
      retry_count: (log.retry_count ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (!provider.configured || !settings.sender_email) {
    const error = !provider.configured ? EMAIL_NOT_CONFIGURED : "Falta el remitente.";
    await finalize(supabase, logId, { status: "skipped", error_message: error });
    return { status: "skipped", logId, error, providerConfigured: provider.configured };
  }

  const from = settings.sender_name
    ? `${settings.sender_name} <${settings.sender_email}>`
    : settings.sender_email;
  const result = await provider.send({
    from,
    to: log.recipient_email,
    subject: tpl?.subject ?? log.subject,
    html: tpl?.body ?? "",
    replyTo: settings.reply_to_email,
  });

  if (result.ok) {
    await finalize(supabase, logId, { status: "sent", provider_message_id: result.messageId ?? null });
    return { status: "sent", logId, providerConfigured: true };
  }
  await finalize(supabase, logId, { status: "failed", error_message: result.error });
  return { status: "failed", logId, error: result.error, providerConfigured: true };
}
