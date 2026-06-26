import { NextResponse } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { getPaymentDashboard } from "@/lib/payments/queries";

// Internal API — decoupled from the Core. Same auth model as the app.
export async function GET() {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const d = await getPaymentDashboard(m.restaurantId);
  return NextResponse.json({ kpis: { today: d.totalToday, week: d.totalWeek, month: d.totalMonth, avgTip: d.avgTip, approvalRate: d.approvalRate }, recent: d.recent });
}
