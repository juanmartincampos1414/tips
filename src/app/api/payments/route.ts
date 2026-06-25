import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { emitEvent } from "@/lib/integrations/events";

// Payments are not implemented yet (Sprint 8C). This establishes the contract +
// PaymentCompleted bus event so a PaymentProvider adapter can wire in cleanly.
export async function POST(req: NextRequest) {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  await emitEvent({
    restaurantId: m.restaurantId,
    type: "PaymentCompleted",
    source: "internal_api",
    payload: { ...body },
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
