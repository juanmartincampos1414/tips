import { NextResponse } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { getSyncJobs } from "@/lib/integrations/manager";

export async function GET() {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ jobs: await getSyncJobs(m.restaurantId) });
}
