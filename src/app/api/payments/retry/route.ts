import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { retryPayment } from "@/lib/payments/service";

export async function POST(req: NextRequest) {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { payment_id } = await req.json().catch(() => ({}));
  if (!payment_id) return NextResponse.json({ error: "payment_id requerido" }, { status: 400 });
  return NextResponse.json(await retryPayment(m.restaurantId, payment_id));
}
