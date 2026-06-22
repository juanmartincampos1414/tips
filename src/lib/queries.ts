import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];
type NfcTag = Database["public"]["Tables"]["nfc_tags"]["Row"];

export type StaffWithNfc = Staff & { nfc_tags: NfcTag[] };

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
