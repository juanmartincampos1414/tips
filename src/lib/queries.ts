import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];
type NfcTag = Database["public"]["Tables"]["nfc_tags"]["Row"];

export type StaffWithNfc = Staff & { nfc_tags: NfcTag[] };

/**
 * Public guest flow: resolve the staff member behind an NFC tap.
 * URL is /t/:slug/:code where :slug is the restaurant slug and :code is the
 * band's nfc_code. Returns the active staff + restaurant, or null (→ 404).
 */
export async function resolvePublicStaff(
  slug: string,
  code: string,
): Promise<{ restaurant: Restaurant; staff: Staff } | null> {
  const supabase = createAdminClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!restaurant) return null;

  const { data: tag } = await supabase
    .from("nfc_tags")
    .select("staff_id")
    .eq("nfc_code", code)
    .eq("status", "active")
    .maybeSingle();
  if (!tag) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("id", tag.staff_id)
    .eq("restaurant_id", restaurant.id)
    .eq("status", "active")
    .maybeSingle();
  if (!staff) return null;

  return { restaurant, staff };
}

/** Records a Visit for a guest opening a staff profile (FR-005 / AC-006). */
export async function recordVisit(restaurantId: string, staffId: string) {
  const supabase = createAdminClient();
  await supabase.from("visits").insert({
    restaurant_id: restaurantId,
    staff_id: staffId,
    source: "nfc",
  });
}

/**
 * Sprint 01 operates on a single restaurant — the first one created in Setup.
 * Returns null when no restaurant exists yet (→ redirect to /setup).
 */
export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getStaffWithNfc(
  restaurantId: string,
): Promise<StaffWithNfc[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("staff")
    .select("*, nfc_tags(*)")
    .eq("restaurant_id", restaurantId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  return (data as StaffWithNfc[] | null) ?? [];
}

export async function getStaffById(
  staffId: string,
): Promise<StaffWithNfc | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("staff")
    .select("*, nfc_tags(*)")
    .eq("id", staffId)
    .maybeSingle();
  return (data as StaffWithNfc | null) ?? null;
}

export type StaffMetrics = {
  averageRating: number | null;
  totalTips: number;
  recognitionEvents: number;
};

/**
 * Per-staff recognition metrics (Sprint 02A · FR-010): average rating,
 * total tips (completed), and recognition event count. Aggregated in JS —
 * fine for a single restaurant's team size.
 */
export async function getStaffMetrics(
  staffIds: string[],
): Promise<Record<string, StaffMetrics>> {
  const empty = (): StaffMetrics => ({
    averageRating: null,
    totalTips: 0,
    recognitionEvents: 0,
  });
  const out: Record<string, StaffMetrics> = {};
  staffIds.forEach((id) => (out[id] = empty()));
  if (staffIds.length === 0) return out;

  const supabase = createAdminClient();
  const [{ data: ratings }, { data: tips }, { data: events }] =
    await Promise.all([
      supabase.from("ratings").select("staff_id, rating").in("staff_id", staffIds),
      supabase
        .from("tips")
        .select("staff_id, amount, payment_status")
        .in("staff_id", staffIds),
      supabase
        .from("recognition_events")
        .select("staff_id")
        .in("staff_id", staffIds),
    ]);

  const ratingSum: Record<string, number> = {};
  const ratingCount: Record<string, number> = {};
  (ratings ?? []).forEach((r) => {
    ratingSum[r.staff_id] = (ratingSum[r.staff_id] ?? 0) + r.rating;
    ratingCount[r.staff_id] = (ratingCount[r.staff_id] ?? 0) + 1;
  });
  staffIds.forEach((id) => {
    if (ratingCount[id])
      out[id].averageRating = ratingSum[id] / ratingCount[id];
  });

  (tips ?? []).forEach((t) => {
    if (t.payment_status === "completed")
      out[t.staff_id].totalTips += Number(t.amount);
  });

  (events ?? []).forEach((e) => {
    out[e.staff_id].recognitionEvents += 1;
  });

  return out;
}

export type CaptureStats = {
  guestsCaptured: number;
  recognitionEvents: number;
  captureRate: number | null; // guests ÷ recognition events
};

/** Sprint 03 main metric — Guest Capture Rate = guests ÷ recognition events. */
export async function getCaptureStats(
  restaurantId: string,
): Promise<CaptureStats> {
  const supabase = createAdminClient();
  const [{ count: guests }, { count: events }] = await Promise.all([
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("recognition_events")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);
  const guestsCaptured = guests ?? 0;
  const recognitionEvents = events ?? 0;
  return {
    guestsCaptured,
    recognitionEvents,
    captureRate: recognitionEvents > 0 ? guestsCaptured / recognitionEvents : null,
  };
}

type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type GuestWithStaff = Guest & { staff: { name: string } | null };

/** CRM base — captured guests for a restaurant, newest first. */
export async function getGuests(restaurantId: string): Promise<GuestWithStaff[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guests")
    .select("*, staff:last_staff_id(name)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  return (data as GuestWithStaff[] | null) ?? [];
}

export type DashboardStats = {
  totalStaff: number;
  totalVisits: number;
};

export async function getDashboardStats(
  restaurantId: string,
): Promise<DashboardStats> {
  const supabase = createAdminClient();

  const [{ count: staffCount }, { count: visitCount }] = await Promise.all([
    supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .neq("status", "archived"),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);

  return {
    totalStaff: staffCount ?? 0,
    totalVisits: visitCount ?? 0,
  };
}
