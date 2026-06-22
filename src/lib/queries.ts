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
