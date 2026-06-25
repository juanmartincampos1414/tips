import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { emitEvent } from "@/lib/integrations/events";

// POST contract for the internal API. Recognition is created by the public guest
// flow; this endpoint establishes the decoupled write contract + bus event.
export async function POST(req: NextRequest) {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  await emitEvent({
    restaurantId: m.restaurantId,
    type: "RecognitionCreated",
    source: "internal_api",
    payload: { ...body },
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
