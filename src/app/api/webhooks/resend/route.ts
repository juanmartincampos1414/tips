import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import {
  applyEmailEvent,
  findLogByProviderId,
  mapResendEvent,
  verifySvixSignature,
} from "@/lib/email/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight status ping (used by the readiness dashboard / manual checks). */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "resend",
    configured: !!process.env.RESEND_WEBHOOK_SECRET,
  });
}

type ResendEvent = {
  type?: string;
  data?: { email_id?: string };
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  // Ready-to-activate: until the secret is set we can't trust callers.
  if (!secret)
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const raw = await req.text();
  const ok = verifySvixSignature(
    secret,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    raw,
  );
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mapped = event.type ? mapResendEvent(event.type) : null;
  const emailId = event.data?.email_id;
  // Always 200 for events we can't action so Resend stops retrying.
  if (!mapped || !emailId)
    return NextResponse.json({ ok: true, ignored: true });

  const supabase = createAdminClient();
  const log = await findLogByProviderId(supabase, emailId);
  if (!log) return NextResponse.json({ ok: true, unmatched: true });

  await applyEmailEvent(supabase, log, mapped, event as unknown as Json);
  return NextResponse.json({ ok: true });
}
