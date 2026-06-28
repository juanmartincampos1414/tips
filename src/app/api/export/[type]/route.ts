import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { tenantDb } from "@/lib/tenant/db";
import {
  fetchAllRows,
  getCrmData,
  getRewards,
  getStaffImpact,
} from "@/lib/queries";
import { rewardValueLabel } from "@/lib/rewards";
import { SEGMENT_LABEL } from "@/lib/segments";

const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const membership = await getCurrentMembership();
  if (!membership || !MANAGER_ROLES.includes(membership.role))
    return new NextResponse("No autorizado", { status: 403 });

  const rid = membership.restaurantId;
  let headers: string[] = [];
  let rows: (string | number | null)[][] = [];

  if (type === "guests") {
    const { guests } = await getCrmData(rid);
    headers = [
      "Nombre", "Email", "Telefono", "Origen", "Segmento",
      "Recognition events", "Return visits", "Rewards reclamadas",
      "Marketing", "Tags", "Alta",
    ];
    rows = guests.map((g) => [
      g.name, g.email, g.phone, g.source, SEGMENT_LABEL[g.segment],
      g.recognitionEvents, g.returnVisits, g.rewardsClaimed,
      g.marketing_consent ? "Si" : "No", g.tags.join(" | "), date(g.created_at),
    ]);
  } else if (type === "rewards") {
    const rewards = await getRewards(rid);
    headers = ["Cliente", "Beneficio", "Valor", "Estado", "Emitida", "Vence"];
    rows = rewards.map((r) => [
      r.guests?.name ?? "",
      r.title,
      rewardValueLabel(r.reward_type, r.value),
      r.status,
      date(r.created_at),
      date(r.expiration_date),
    ]);
  } else if (type === "reviews") {
    const data = await fetchAllRows<{
      route: string;
      status: string;
      created_at: string;
      recognition_events: { guests: { name: string } | null } | null;
    }>((f, t) =>
      tenantDb(rid)
        .select("review_requests", "route, status, created_at, recognition_events(guests(name))")
        .order("created_at", { ascending: false })
        .range(f, t),
    );
    headers = ["Cliente", "Ruta", "Estado", "Fecha"];
    rows = data.map((r) => [
      r.recognition_events?.guests?.name ?? "",
      r.route,
      r.status,
      date(r.created_at),
    ]);
  } else if (type === "return_visits") {
    const data = await fetchAllRows<{
      created_at: string;
      guests: { name: string; email: string } | null;
    }>((f, t) =>
      tenantDb(rid)
        .select("return_visits", "created_at, guests(name, email)")
        .order("created_at", { ascending: false })
        .range(f, t),
    );
    headers = ["Cliente", "Email", "Fecha"];
    rows = data.map((r) => [
      r.guests?.name ?? "",
      r.guests?.email ?? "",
      date(r.created_at),
    ]);
  } else if (type === "staff_impact") {
    const impact = await getStaffImpact(rid);
    headers = [
      "Camarero", "Recognition events", "Rating promedio", "Reviews",
      "Guests capturados", "Rewards emitidas", "Rewards reclamadas", "Return visits",
      "Clientes recuperados",
    ];
    rows = impact.map((s) => [
      s.name, s.recognitionEvents,
      s.avgRating != null ? s.avgRating.toFixed(2) : "",
      s.reviews, s.guestsCaptured, s.rewardsIssued, s.rewardsClaimed, s.returnVisits,
      s.recoveredGuests,
    ]);
  } else {
    return new NextResponse("Tipo inválido", { status: 400 });
  }

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tips-${type}.csv"`,
    },
  });
}
