import { NextResponse } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { getCrmData } from "@/lib/queries";

export async function GET() {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { guests, kpis } = await getCrmData(m.restaurantId);
  return NextResponse.json({ kpis, count: guests.length, guests: guests.slice(0, 200) });
}
