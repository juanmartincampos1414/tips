import "server-only";

import { fetchAllRows } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";

import { emailFlags, resendListDomains } from "./provider";

export type ChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export type EmailHealth = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  processing: number;
  pending: number;
  skipped: number;
};

export type EmailReadiness = {
  provider: "resend" | "mock";
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  senderEmail: string | null;
  senderConfigured: boolean;
  emailEnabled: boolean;
  domain: { name: string; verified: boolean } | null;
  domainChecked: boolean;
  webhookActive: boolean;
  activated: boolean;
  checklist: ChecklistItem[];
  health: EmailHealth;
};

function domainOf(email: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1].toLowerCase();
}

export async function getEmailReadiness(
  restaurantId: string,
): Promise<EmailReadiness> {
  const flags = emailFlags();
  const supabase = createAdminClient();

  // logs/events scale with sends → paginate past the 1000 cap for true health.
  const [{ data: settings }, logs, events, domains] = await Promise.all([
    supabase
      .from("restaurant_settings")
      .select("sender_email, email_enabled")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    fetchAllRows<{ status: string }>((f, t) =>
      supabase.from("email_logs").select("status").eq("restaurant_id", restaurantId).range(f, t),
    ),
    fetchAllRows<{ event_type: string }>((f, t) =>
      supabase.from("email_events").select("event_type").eq("restaurant_id", restaurantId).range(f, t),
    ),
    resendListDomains(),
  ]);

  const senderEmail = settings?.sender_email ?? null;
  const emailEnabled = settings?.email_enabled ?? false;

  // Domain validation (best-effort, only when the API key is present).
  let domain: { name: string; verified: boolean } | null = null;
  const domainChecked = flags.hasApiKey && domains !== null;
  if (domainChecked && domains) {
    const senderDomain = domainOf(senderEmail);
    const match = domains.find((d) => d.name.toLowerCase() === senderDomain);
    if (match) domain = { name: match.name, verified: match.status === "verified" };
    else if (senderDomain) domain = { name: senderDomain, verified: false };
  }

  const countStatus = (s: string) => (logs ?? []).filter((l) => l.status === s).length;
  const countEvent = (t: string) => (events ?? []).filter((e) => e.event_type === t).length;
  const health: EmailHealth = {
    sent: countStatus("sent"),
    delivered: countEvent("delivered"),
    opened: countEvent("opened"),
    clicked: countEvent("clicked"),
    bounced: countEvent("bounced"),
    complained: countEvent("complained"),
    failed: countStatus("failed"),
    processing: countStatus("processing"),
    pending: countStatus("pending"),
    skipped: countStatus("skipped"),
  };

  const webhookActive = flags.hasWebhookSecret;
  const senderConfigured = !!senderEmail;
  const activated =
    flags.hasApiKey && webhookActive && senderConfigured && emailEnabled;

  const checklist: ChecklistItem[] = [
    {
      key: "RESEND_API_KEY",
      label: "RESEND_API_KEY",
      ok: flags.hasApiKey,
      hint: flags.hasApiKey ? undefined : "Cargá la API key en las env vars de Vercel.",
    },
    {
      key: "RESEND_WEBHOOK_SECRET",
      label: "RESEND_WEBHOOK_SECRET",
      ok: flags.hasWebhookSecret,
      hint: flags.hasWebhookSecret ? undefined : "Cargá el webhook secret (whsec_…) en Vercel.",
    },
    {
      key: "sender_email",
      label: "sender_email",
      ok: senderConfigured,
      hint: senderConfigured ? undefined : "Definí el remitente en Configuración.",
    },
    {
      key: "email_enabled",
      label: "email_enabled",
      ok: emailEnabled,
      hint: emailEnabled ? undefined : "Activá el envío en Configuración.",
    },
  ];

  return {
    provider: flags.provider,
    hasApiKey: flags.hasApiKey,
    hasWebhookSecret: flags.hasWebhookSecret,
    senderEmail,
    senderConfigured,
    emailEnabled,
    domain,
    domainChecked,
    webhookActive,
    activated,
    checklist,
    health,
  };
}
