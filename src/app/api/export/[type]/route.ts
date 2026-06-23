import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership, MANAGER_ROLES } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { createAdminClient } from "@/lib/supabase/admin";
import {
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
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("review_requests")
      .select("route, status, created_at, recognition_events(guests(name))")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false });
    headers = ["Cliente", "Ruta", "Estado", "Fecha"];
    rows = (
      (data as
        | {
            route: string;
            status: string;
            created_at: string;
            recognition_events: { guests: { name: string } | null } | null;
          }[]
        | null) ?? []
    ).map((r) => [
      r.recognition_events?.guests?.name ?? "",
      r.route,
      r.status,
      date(r.created_at),
    ]);
  } else if (type === "return_visits") {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("return_visits")
      .select("created_at, guests(name, email)")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false });
    headers = ["Cliente", "Email", "Fecha"];
    rows = (
      (data as
        | { created_at: string; guests: { name: string; email: string } | null }[]
        | null) ?? []
    ).map((r) => [
      r.guests?.name ?? "",
      r.guests?.email ?? "",
      date(r.created_at),
    ]);
  } else if (type === "staff_impact") {
    const impact = await getStaffImpact(rid);
    headers = [
      "Camarero", "Recognition events", "Rating promedio", "Reviews",
      "Guests capturados", "Rewards emitidas", "Rewards reclamadas", "Return visits",
    ];
    rows = impact.map((s) => [
      s.name, s.recognitionEvents,
      s.avgRating != null ? s.avgRating.toFixed(2) : "",
      s.reviews, s.guestsCaptured, s.rewardsIssued, s.rewardsClaimed, s.returnVisits,
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
