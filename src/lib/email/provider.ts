import "server-only";

// -----------------------------------------------------------------------------
// Provider abstraction — the rest of the app talks to EmailProvider, never to
// Resend directly. Swap the implementation (Postmark, SES, …) without touching
// callers or the data model.
// -----------------------------------------------------------------------------

export type SendParams = {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
};

export type SendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** True when the provider is not configured (mock mode) — not a real failure. */
  skipped?: boolean;
};

export interface EmailProvider {
  readonly name: string;
  readonly configured: boolean;
  send(params: SendParams): Promise<SendResult>;
}

const NOT_CONFIGURED = "Email provider not configured";

/** Used when no provider key is present: never throws, never sends. */
class MockProvider implements EmailProvider {
  readonly name = "mock";
  readonly configured = false;
  async send(): Promise<SendResult> {
    return { ok: false, skipped: true, error: NOT_CONFIGURED };
  }
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  readonly configured = true;
  constructor(private readonly apiKey: string) {}

  async send(params: SendParams): Promise<SendResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: params.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!res.ok)
        return { ok: false, error: data.message ?? `Resend error ${res.status}` };
      return { ok: true, messageId: data.id };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/** Factory: Resend when RESEND_API_KEY is set, otherwise a safe mock. */
export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendProvider(key) : new MockProvider();
}

export const EMAIL_NOT_CONFIGURED = NOT_CONFIGURED;
