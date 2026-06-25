import { NextResponse } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { getIntegrationsView } from "@/lib/integrations/manager";

// Internal API — decouples the UI from the Core. Same auth model as the app.
export async function GET() {
  const m = await getCurrentMembership();
  if (!m || !MANAGER_ROLES.includes(m.role))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await getIntegrationsView(m.restaurantId));
}
