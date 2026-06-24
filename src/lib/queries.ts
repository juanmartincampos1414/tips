import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import {
  contactChannels,
  formatPhone,
  type PreferredChannel,
} from "@/lib/phone";
import {
  computeCampaignKpis,
  engagementScore,
  estimateRevenue,
  segmentLabel,
  type CampaignKpis,
} from "@/lib/campaigns";
import type {
  CampaignChannel,
  ConversionType,
  Database,
} from "@/lib/database.types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];
type NfcTag = Database["public"]["Tables"]["nfc_tags"]["Row"];

export type StaffWithNfc = Staff & { nfc_tags: NfcTag[] };

type NfcInventory = Database["public"]["Tables"]["nfc_inventory"]["Row"];
export type NfcWithStaff = NfcInventory & { staff: { name: string } | null };
export type StaffWithBand = Staff & {
  band: { uid: string; serial_number: string } | null;
};

const NFC_STATUSES = [
  "stock",
  "assigned",
  "lost",
  "damaged",
  "archived",
] as const;

export async function getNfcInventory(
  restaurantId: string,
  status?: string,
): Promise<NfcWithStaff[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("nfc_inventory")
    .select("*, staff:assigned_staff_id(name)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (status && (NFC_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status as NfcInventory["status"]);
  }
  const { data } = await query;
  return (data as NfcWithStaff[] | null) ?? [];
}

export type NfcKpis = {
  total: number;
  assigned: number;
  stock: number;
  lost: number;
  damaged: number;
};

export async function getNfcKpis(restaurantId: string): Promise<NfcKpis> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("nfc_inventory")
    .select("status")
    .eq("restaurant_id", restaurantId);
  const rows = data ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    assigned: count("assigned"),
    stock: count("stock"),
    lost: count("lost"),
    damaged: count("damaged"),
  };
}

/** Staff list with their current assigned band (if any). */
export async function getStaffWithBand(
  restaurantId: string,
): Promise<StaffWithBand[]> {
  const supabase = createAdminClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (!staff?.length) return [];

  const { data: bands } = await supabase
    .from("nfc_inventory")
    .select("uid, serial_number, assigned_staff_id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "assigned");

  const byStaff = new Map(
    (bands ?? []).map((b) => [b.assigned_staff_id, b]),
  );
  return staff.map((s) => {
    const b = byStaff.get(s.id);
    return {
      ...s,
      band: b ? { uid: b.uid, serial_number: b.serial_number } : null,
    };
  });
}

export async function getStaffBand(
  staffId: string,
): Promise<NfcInventory | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("nfc_inventory")
    .select("*")
    .eq("assigned_staff_id", staffId)
    .eq("status", "assigned")
    .maybeSingle();
  return data ?? null;
}

export type NfcEventRow = {
  id: string;
  event: Database["public"]["Tables"]["nfc_events"]["Row"]["event"];
  created_at: string;
  nfc_inventory: { uid: string; serial_number: string } | null;
};

/** Full NFC history for a staff member (every band ever involving them). */
export async function getStaffNfcHistory(
  staffId: string,
): Promise<NfcEventRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("nfc_events")
    .select("id, event, created_at, nfc_inventory(uid, serial_number)")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });
  return (data as NfcEventRow[] | null) ?? [];
}

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

  // Resolve the band by its uid in the inventory (must be assigned).
  const { data: band } = await supabase
    .from("nfc_inventory")
    .select("assigned_staff_id")
    .eq("restaurant_id", restaurant.id)
    .eq("uid", code)
    .eq("status", "assigned")
    .maybeSingle();
  if (!band?.assigned_staff_id) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("id", band.assigned_staff_id)
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
 * The restaurant the logged-in user belongs to (via restaurant_members).
 * Returns null when the user has no membership yet (→ Setup for a new owner).
 */
export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", membership.restaurantId)
    .neq("status", "archived")
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

type RewardTemplate = Database["public"]["Tables"]["reward_templates"]["Row"];
type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type RewardWithGuest = Reward & {
  guests: { name: string | null } | null;
  wallet_passes: { pass_identifier: string }[];
};

/** FR-025 (lazy): flip overdue active rewards to expired before reading them. */
export async function expireDueRewards(restaurantId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("rewards")
    .update({ status: "expired" })
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .lt("expiration_date", new Date().toISOString());
}

export async function getRewardTemplates(
  restaurantId: string,
): Promise<RewardTemplate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reward_templates")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getRewards(
  restaurantId: string,
): Promise<RewardWithGuest[]> {
  await expireDueRewards(restaurantId);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("rewards")
    .select("*, guests(name), wallet_passes(pass_identifier)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  return (data as RewardWithGuest[] | null) ?? [];
}

export type DashboardKpis = {
  guestsCaptured: number;
  returningGuests: number;
  returnVisitRate: number | null;
  recognitionEvents: number;
  reviewsGenerated: number;
  activeRewards: number;
  claimedRewards: number;
  activeStaff: number;
  guestCaptureRate: number | null;
  rewardClaimRate: number | null;
};

/** FR-023 — the full Sprint 04 dashboard KPI set, computed live. */
export async function getDashboardKpis(
  restaurantId: string,
): Promise<DashboardKpis> {
  await expireDueRewards(restaurantId);
  const supabase = createAdminClient();
  const head = { count: "exact" as const, head: true };

  const [
    guests,
    events,
    reviews,
    active,
    claimed,
    totalRewards,
    staff,
    { data: returns },
  ] = await Promise.all([
    supabase.from("guests").select("id", head).eq("restaurant_id", restaurantId),
    supabase
      .from("recognition_events")
      .select("id", head)
      .eq("restaurant_id", restaurantId),
    supabase
      .from("review_requests")
      .select("id", head)
      .eq("restaurant_id", restaurantId)
      .eq("route", "public_review")
      .eq("status", "completed"),
    supabase
      .from("rewards")
      .select("id", head)
      .eq("restaurant_id", restaurantId)
      .eq("status", "active"),
    supabase
      .from("rewards")
      .select("id", head)
      .eq("restaurant_id", restaurantId)
      .eq("status", "claimed"),
    supabase.from("rewards").select("id", head).eq("restaurant_id", restaurantId),
    supabase
      .from("staff")
      .select("id", head)
      .eq("restaurant_id", restaurantId)
      .eq("status", "active"),
    supabase
      .from("return_visits")
      .select("guest_id")
      .eq("restaurant_id", restaurantId),
  ]);

  const guestsCaptured = guests.count ?? 0;
  const recognitionEvents = events.count ?? 0;
  const claimedRewards = claimed.count ?? 0;
  const issued = totalRewards.count ?? 0;
  const returningGuests = new Set(
    (returns ?? []).map((r) => r.guest_id),
  ).size;

  return {
    guestsCaptured,
    returningGuests,
    returnVisitRate: guestsCaptured > 0 ? returningGuests / guestsCaptured : null,
    recognitionEvents,
    reviewsGenerated: reviews.count ?? 0,
    activeRewards: active.count ?? 0,
    claimedRewards,
    activeStaff: staff.count ?? 0,
    guestCaptureRate:
      recognitionEvents > 0 ? guestsCaptured / recognitionEvents : null,
    rewardClaimRate: issued > 0 ? claimedRewards / issued : null,
  };
}

export type WalletPassFull = {
  id: string;
  pass_identifier: string;
  restaurant_id: string;
  status: Database["public"]["Tables"]["wallet_passes"]["Row"]["status"];
  rewards: {
    id: string;
    title: string;
    reward_type: Reward["reward_type"];
    value: number;
    status: Reward["status"];
    expiration_date: string;
  } | null;
  guests: { name: string | null } | null;
  restaurants: { name: string; logo_url: string | null; slug: string } | null;
};

/** Public wallet pass resolution (pass + reward + guest + restaurant). */
export async function getWalletPass(
  passIdentifier: string,
): Promise<WalletPassFull | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("wallet_passes")
    .select(
      "id, pass_identifier, restaurant_id, status, rewards(id, title, reward_type, value, status, expiration_date), guests(name), restaurants(name, logo_url, slug)",
    )
    .eq("pass_identifier", passIdentifier)
    .maybeSingle();
  return (data as WalletPassFull | null) ?? null;
}

type Settings = Database["public"]["Tables"]["restaurant_settings"]["Row"];

export async function getSettings(
  restaurantId: string,
): Promise<Settings | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("restaurant_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data ?? null;
}

export type EmailTemplate =
  Database["public"]["Tables"]["email_templates"]["Row"];

export async function getEmailTemplates(
  restaurantId: string,
): Promise<EmailTemplate[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type MemberRow = {
  id: string;
  role: Database["public"]["Tables"]["restaurant_members"]["Row"]["role"];
  email: string | null;
  staffName: string | null;
  created_at: string;
};

/** Team members of a restaurant, with their login email + linked staff. */
export async function getMembers(restaurantId: string): Promise<MemberRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("restaurant_members")
    .select("id, role, user_id, created_at, staff:staff_id(name)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Array<{
    id: string;
    role: MemberRow["role"];
    user_id: string;
    created_at: string;
    staff: { name: string } | null;
  }>;

  return Promise.all(
    rows.map(async (m) => {
      const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
      return {
        id: m.id,
        role: m.role,
        email: u.user?.email ?? null,
        staffName: m.staff?.name ?? null,
        created_at: m.created_at,
      };
    }),
  );
}

export async function getStaffOptions(
  restaurantId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("staff")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .neq("status", "archived")
    .order("name");
  return data ?? [];
}

type GuestNote = Database["public"]["Tables"]["guest_notes"]["Row"];
type GuestTag = Database["public"]["Tables"]["guest_tags"]["Row"];

export type GuestListRow = GuestWithStaff & {
  segment: import("@/lib/segments").Segment;
  returnVisits: number;
};

export type CrmGuest = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null; // formatted for display (never raw)
  phoneNormalized: string | null; // E.164
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsapp: boolean;
  preferredChannel: PreferredChannel;
  source: string;
  marketing_consent: boolean;
  lastStaffName: string | null;
  created_at: string;
  segment: import("@/lib/segments").Segment;
  recognitionEvents: number;
  returnVisits: number;
  rewardsClaimed: number;
  activeRewards: number;
  tags: string[];
  lastActivity: string;
};

export type CrmKpis = {
  total: number;
  newCount: number;
  returning: number;
  vip: number;
  atRisk: number;
  lost: number;
  imported: number;
  tips: number;
  captureRate: number | null;
  returnVisitRate: number | null;
  rewardRedemptionRate: number | null;
};

export async function getCrmData(
  restaurantId: string,
): Promise<{ guests: CrmGuest[]; kpis: CrmKpis }> {
  const { computeSegment } = await import("@/lib/segments");
  const supabase = createAdminClient();
  const [
    { data: guests },
    { data: events },
    { data: returns },
    { data: rewards },
    { data: tags },
  ] = await Promise.all([
    supabase
      .from("guests")
      .select("*, staff:last_staff_id(name)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("recognition_events")
      .select("guest_id, created_at")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("return_visits")
      .select("guest_id, created_at")
      .eq("restaurant_id", restaurantId),
    supabase.from("rewards").select("guest_id, status").eq("restaurant_id", restaurantId),
    supabase.from("guest_tags").select("guest_id, tag").eq("restaurant_id", restaurantId),
  ]);

  const eventsByGuest = new Map<string, number>();
  const lastByGuest = new Map<string, string>();
  const setLast = (g: string | null, d: string) => {
    if (!g) return;
    if (!lastByGuest.get(g) || lastByGuest.get(g)! < d) lastByGuest.set(g, d);
  };
  for (const e of events ?? []) {
    if (e.guest_id) eventsByGuest.set(e.guest_id, (eventsByGuest.get(e.guest_id) ?? 0) + 1);
    setLast(e.guest_id, e.created_at);
  }
  const returnsByGuest = new Map<string, number>();
  for (const r of returns ?? []) {
    returnsByGuest.set(r.guest_id, (returnsByGuest.get(r.guest_id) ?? 0) + 1);
    setLast(r.guest_id, r.created_at);
  }
  const claimedByGuest = new Map<string, number>();
  const activeByGuest = new Map<string, number>();
  let totalClaimed = 0,
    totalIssued = 0;
  for (const rw of rewards ?? []) {
    totalIssued++;
    if (rw.status === "claimed") {
      totalClaimed++;
      claimedByGuest.set(rw.guest_id, (claimedByGuest.get(rw.guest_id) ?? 0) + 1);
    } else if (rw.status === "active") {
      activeByGuest.set(rw.guest_id, (activeByGuest.get(rw.guest_id) ?? 0) + 1);
    }
  }
  const tagsByGuest = new Map<string, string[]>();
  for (const t of tags ?? [])
    tagsByGuest.set(t.guest_id, [...(tagsByGuest.get(t.guest_id) ?? []), t.tag]);

  const crm: CrmGuest[] = (
    (guests as (Guest & { staff: { name: string } | null })[] | null) ?? []
  ).map((g) => {
    const returnVisits = returnsByGuest.get(g.id) ?? 0;
    const lastActivity = lastByGuest.get(g.id) ?? g.updated_at;
    const channels = contactChannels({
      email: g.email,
      phoneNormalized: g.phone_normalized,
      marketingConsent: g.marketing_consent,
    });
    return {
      id: g.id,
      name: g.name,
      email: g.email,
      // Never surface raw phones: prefer the normalized E.164, formatted.
      phone: formatPhone(g.phone_normalized) ?? formatPhone(g.phone),
      phoneNormalized: g.phone_normalized,
      hasEmail: channels.has_email,
      hasPhone: channels.has_phone,
      hasWhatsapp: channels.has_whatsapp,
      preferredChannel: channels.preferred_channel,
      source: g.source,
      marketing_consent: g.marketing_consent,
      lastStaffName: g.staff?.name ?? null,
      created_at: g.created_at,
      recognitionEvents: eventsByGuest.get(g.id) ?? 0,
      returnVisits,
      rewardsClaimed: claimedByGuest.get(g.id) ?? 0,
      activeRewards: activeByGuest.get(g.id) ?? 0,
      tags: tagsByGuest.get(g.id) ?? [],
      lastActivity,
      segment: computeSegment({
        recognitionEvents: 0,
        reviews: 0,
        avgRating: null,
        rewardsIssued: 0,
        rewardsClaimed: claimedByGuest.get(g.id) ?? 0,
        returnVisits,
        lastActivity,
      }),
    };
  });

  const totalEvents = (events ?? []).length;
  const seg = (s: string) => crm.filter((g) => g.segment === s).length;
  const tipsCount = crm.filter((g) => g.source !== "import").length;
  const returning = crm.filter((g) => g.returnVisits >= 1).length;

  return {
    guests: crm,
    kpis: {
      total: crm.length,
      newCount: seg("new"),
      returning: seg("returning"),
      vip: seg("vip"),
      atRisk: seg("at_risk"),
      lost: seg("lost"),
      imported: crm.filter((g) => g.source === "import").length,
      tips: tipsCount,
      captureRate: totalEvents > 0 ? tipsCount / totalEvents : null,
      returnVisitRate: crm.length > 0 ? returning / crm.length : null,
      rewardRedemptionRate: totalIssued > 0 ? totalClaimed / totalIssued : null,
    },
  };
}

/** Guests with their computed segment (cheap aggregates, pilot scale). */
export async function getGuestsList(
  restaurantId: string,
): Promise<GuestListRow[]> {
  const { computeSegment } = await import("@/lib/segments");
  const supabase = createAdminClient();
  const [{ data: guests }, { data: events }, { data: returns }] =
    await Promise.all([
      supabase
        .from("guests")
        .select("*, staff:last_staff_id(name)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("recognition_events")
        .select("guest_id, created_at")
        .eq("restaurant_id", restaurantId)
        .not("guest_id", "is", null),
      supabase
        .from("return_visits")
        .select("guest_id, created_at")
        .eq("restaurant_id", restaurantId),
    ]);

  const lastByGuest = new Map<string, string>();
  const returnsByGuest = new Map<string, number>();
  for (const e of events ?? []) {
    const g = e.guest_id as string;
    if (!lastByGuest.get(g) || lastByGuest.get(g)! < e.created_at)
      lastByGuest.set(g, e.created_at);
  }
  for (const r of returns ?? []) {
    returnsByGuest.set(r.guest_id, (returnsByGuest.get(r.guest_id) ?? 0) + 1);
    if (!lastByGuest.get(r.guest_id) || lastByGuest.get(r.guest_id)! < r.created_at)
      lastByGuest.set(r.guest_id, r.created_at);
  }

  return ((guests as GuestWithStaff[] | null) ?? []).map((g) => {
    const returnVisits = returnsByGuest.get(g.id) ?? 0;
    const lastActivity = lastByGuest.get(g.id) ?? g.updated_at;
    return {
      ...g,
      returnVisits,
      segment: computeSegment({
        recognitionEvents: 0,
        reviews: 0,
        avgRating: null,
        rewardsIssued: 0,
        rewardsClaimed: 0,
        returnVisits,
        lastActivity,
      }),
    };
  });
}

export type GuestProfile = {
  guest: Guest;
  lastStaffName: string | null;
  stats: import("@/lib/segments").GuestStats;
  notes: GuestNote[];
  tags: GuestTag[];
};

export async function getGuestProfile(
  guestId: string,
): Promise<GuestProfile | null> {
  const supabase = createAdminClient();
  const { data: guest } = await supabase
    .from("guests")
    .select("*, staff:last_staff_id(name)")
    .eq("id", guestId)
    .maybeSingle();
  if (!guest) return null;
  const { staff, ...guestRow } = guest as Guest & {
    staff: { name: string } | null;
  };

  const [events, rewards, returns, reviewsCount, notesRes, tagsRes] =
    await Promise.all([
      supabase
        .from("recognition_events")
        .select("created_at, ratings(rating)")
        .eq("guest_id", guestId),
      supabase.from("rewards").select("status").eq("guest_id", guestId),
      supabase
        .from("return_visits")
        .select("created_at")
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false }),
      supabase
        .from("review_requests")
        .select("id, recognition_events!inner(guest_id)", {
          count: "exact",
          head: true,
        })
        .eq("recognition_events.guest_id", guestId)
        .eq("route", "public_review")
        .eq("status", "completed"),
      supabase
        .from("guest_notes")
        .select("*")
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false }),
      supabase
        .from("guest_tags")
        .select("*")
        .eq("guest_id", guestId)
        .order("created_at", { ascending: true }),
    ]);

  const eventRows = (events.data ?? []) as {
    created_at: string;
    ratings: { rating: number } | null;
  }[];
  const ratings = eventRows
    .map((e) => e.ratings?.rating)
    .filter((r): r is number => typeof r === "number");
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;

  const rewardRows = rewards.data ?? [];
  const returnRows = returns.data ?? [];

  const activityDates = [
    ...eventRows.map((e) => e.created_at),
    ...returnRows.map((r) => r.created_at),
    guestRow.updated_at,
  ].filter(Boolean) as string[];
  const lastActivity = activityDates.length
    ? activityDates.sort().at(-1)!
    : null;

  return {
    guest: guestRow,
    lastStaffName: staff?.name ?? null,
    notes: notesRes.data ?? [],
    tags: tagsRes.data ?? [],
    stats: {
      recognitionEvents: eventRows.length,
      reviews: reviewsCount.count ?? 0,
      avgRating,
      rewardsIssued: rewardRows.length,
      rewardsClaimed: rewardRows.filter((r) => r.status === "claimed").length,
      returnVisits: returnRows.length,
      lastActivity,
    },
  };
}

export type TimelineItem = {
  type: string;
  label: string;
  detail: string | null;
  at: string;
};

export async function getGuestTimeline(
  guestId: string,
): Promise<TimelineItem[]> {
  const supabase = createAdminClient();
  const [events, reviews, rewards, claims, returns, notes] = await Promise.all([
    supabase
      .from("recognition_events")
      .select("created_at, ratings(rating), tips(amount)")
      .eq("guest_id", guestId),
    supabase
      .from("review_requests")
      .select("created_at, route, status, recognition_events!inner(guest_id)")
      .eq("recognition_events.guest_id", guestId),
    supabase
      .from("rewards")
      .select("created_at, title")
      .eq("guest_id", guestId),
    supabase
      .from("reward_claims")
      .select("claimed_at, rewards(title)")
      .eq("guest_id", guestId),
    supabase.from("return_visits").select("created_at").eq("guest_id", guestId),
    supabase
      .from("guest_notes")
      .select("created_at, body")
      .eq("guest_id", guestId),
  ]);

  const items: TimelineItem[] = [];
  for (const e of (events.data ?? []) as {
    created_at: string;
    ratings: { rating: number } | null;
    tips: { amount: number } | null;
  }[]) {
    items.push({
      type: "recognition",
      label: "Reconocimiento",
      detail: [
        e.ratings ? `${e.ratings.rating}★` : null,
        e.tips ? `propina $${Number(e.tips.amount).toLocaleString("es-AR")}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      at: e.created_at,
    });
  }
  for (const r of (reviews.data ?? []) as {
    created_at: string;
    route: string;
    status: string;
  }[]) {
    items.push({
      type: "review",
      label: r.route === "public_review" ? "Reseña pública" : "Feedback privado",
      detail: r.status === "completed" ? "completada" : r.status,
      at: r.created_at,
    });
  }
  for (const r of (rewards.data ?? []) as {
    created_at: string;
    title: string;
  }[]) {
    items.push({
      type: "reward_issued",
      label: "Reward emitida",
      detail: r.title,
      at: r.created_at,
    });
  }
  for (const c of (claims.data ?? []) as {
    claimed_at: string;
    rewards: { title: string } | null;
  }[]) {
    items.push({
      type: "reward_claimed",
      label: "Reward reclamada",
      detail: c.rewards?.title ?? null,
      at: c.claimed_at,
    });
  }
  for (const v of (returns.data ?? []) as { created_at: string }[]) {
    items.push({
      type: "return_visit",
      label: "Return visit",
      detail: null,
      at: v.created_at,
    });
  }
  for (const n of (notes.data ?? []) as { created_at: string; body: string }[]) {
    items.push({
      type: "note",
      label: "Nota",
      detail: n.body,
      at: n.created_at,
    });
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

type GuestImport = Database["public"]["Tables"]["guest_imports"]["Row"];
type GuestImportRow = Database["public"]["Tables"]["guest_import_rows"]["Row"];

export async function getImports(
  restaurantId: string,
): Promise<GuestImport[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_imports")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getImport(
  importId: string,
  restaurantId: string,
): Promise<GuestImport | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_imports")
    .select("*")
    .eq("id", importId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data ?? null;
}

export async function getImportRows(
  importId: string,
  limit = 100,
): Promise<GuestImportRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("guest_import_rows")
    .select("*")
    .eq("import_id", importId)
    .order("row_number")
    .limit(limit);
  return data ?? [];
}

export type StaffImpactRow = {
  id: string;
  name: string;
  recognitionEvents: number;
  avgRating: number | null;
  reviews: number;
  guestsCaptured: number;
  rewardsIssued: number;
  rewardsClaimed: number;
  returnVisits: number;
  recoveredGuests: number;
};

export async function getStaffImpact(
  restaurantId: string,
): Promise<StaffImpactRow[]> {
  await syncCampaignConversions(restaurantId);
  const supabase = createAdminClient();
  const [
    { data: staff },
    { data: events },
    { data: ratings },
    { data: reviews },
    { data: guests },
    { data: rewards },
    { data: returns },
    { data: campReturns },
  ] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .neq("status", "archived"),
    supabase
      .from("recognition_events")
      .select("id, staff_id, rating_id")
      .eq("restaurant_id", restaurantId),
    supabase.from("ratings").select("id, rating"),
    supabase
      .from("review_requests")
      .select("recognition_event_id, route, status")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("guests")
      .select("id, last_staff_id")
      .eq("restaurant_id", restaurantId),
    supabase.from("rewards").select("guest_id, status").eq("restaurant_id", restaurantId),
    supabase.from("return_visits").select("guest_id").eq("restaurant_id", restaurantId),
    supabase
      .from("campaign_conversions")
      .select("guest_id")
      .eq("restaurant_id", restaurantId)
      .eq("conversion_type", "return_visit"),
  ]);

  const ratingById = new Map((ratings ?? []).map((r) => [r.id, r.rating]));
  const eventStaff = new Map<string, string>(); // event id → staff
  const recCount = new Map<string, number>();
  const ratingSum = new Map<string, number>();
  const ratingN = new Map<string, number>();
  for (const e of events ?? []) {
    if (!e.staff_id) continue;
    eventStaff.set(e.id, e.staff_id);
    recCount.set(e.staff_id, (recCount.get(e.staff_id) ?? 0) + 1);
    const rv = e.rating_id ? ratingById.get(e.rating_id) : undefined;
    if (typeof rv === "number") {
      ratingSum.set(e.staff_id, (ratingSum.get(e.staff_id) ?? 0) + rv);
      ratingN.set(e.staff_id, (ratingN.get(e.staff_id) ?? 0) + 1);
    }
  }
  const reviewCount = new Map<string, number>();
  for (const rr of reviews ?? []) {
    if (rr.route !== "public_review" || rr.status !== "completed") continue;
    const s = rr.recognition_event_id ? eventStaff.get(rr.recognition_event_id) : null;
    if (s) reviewCount.set(s, (reviewCount.get(s) ?? 0) + 1);
  }
  const guestStaff = new Map<string, string>(); // guest → last staff
  const captured = new Map<string, number>();
  for (const g of guests ?? []) {
    if (g.last_staff_id) {
      guestStaff.set(g.id, g.last_staff_id);
      captured.set(g.last_staff_id, (captured.get(g.last_staff_id) ?? 0) + 1);
    }
  }
  const rIssued = new Map<string, number>();
  const rClaimed = new Map<string, number>();
  for (const rw of rewards ?? []) {
    const s = guestStaff.get(rw.guest_id);
    if (!s) continue;
    rIssued.set(s, (rIssued.get(s) ?? 0) + 1);
    if (rw.status === "claimed") rClaimed.set(s, (rClaimed.get(s) ?? 0) + 1);
  }
  const retCount = new Map<string, number>();
  for (const v of returns ?? []) {
    const s = guestStaff.get(v.guest_id);
    if (s) retCount.set(s, (retCount.get(s) ?? 0) + 1);
  }
  // Recovered guests: distinct guests with a campaign-attributed return visit,
  // credited to the staff that owns the guest (last_staff_id).
  const recoveredByStaff = new Map<string, Set<string>>();
  for (const cv of campReturns ?? []) {
    const s = guestStaff.get(cv.guest_id);
    if (!s) continue;
    if (!recoveredByStaff.has(s)) recoveredByStaff.set(s, new Set());
    recoveredByStaff.get(s)!.add(cv.guest_id);
  }

  return ((staff as { id: string; name: string }[] | null) ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    recognitionEvents: recCount.get(s.id) ?? 0,
    avgRating: ratingN.get(s.id) ? ratingSum.get(s.id)! / ratingN.get(s.id)! : null,
    reviews: reviewCount.get(s.id) ?? 0,
    guestsCaptured: captured.get(s.id) ?? 0,
    rewardsIssued: rIssued.get(s.id) ?? 0,
    rewardsClaimed: rClaimed.get(s.id) ?? 0,
    returnVisits: retCount.get(s.id) ?? 0,
    recoveredGuests: recoveredByStaff.get(s.id)?.size ?? 0,
  }));
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

// ===========================================================================
// Sprint 7.5 — Campaign Builder Foundation
// ===========================================================================

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

type DatedEvent = {
  guest_id: string;
  type: ConversionType;
  date: string;
  source_event_id: string;
};

/**
 * Attribution engine. For every completed campaign, attribute each audience
 * guest's reward-claim / return-visit / review / recognition events that fall
 * inside the campaign window into campaign_conversions. Idempotent (unique
 * constraint) — runs lazily on read, no cron.
 */
export async function syncCampaignConversions(
  restaurantId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, sent_at, attribution_window_days")
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed")
    .not("sent_at", "is", null);
  if (!campaigns || campaigns.length === 0) return;

  const [{ data: aud }, { data: claims }, { data: returns }, { data: recs }, { data: reviews }] =
    await Promise.all([
      supabase
        .from("campaign_audiences")
        .select("campaign_id, guest_id")
        .in("campaign_id", campaigns.map((c) => c.id)),
      supabase
        .from("reward_claims")
        .select("id, guest_id, claimed_at")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("return_visits")
        .select("id, guest_id, created_at")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("recognition_events")
        .select("id, guest_id, created_at")
        .eq("restaurant_id", restaurantId)
        .not("guest_id", "is", null),
      supabase
        .from("review_requests")
        .select("id, recognition_event_id, completed_at, status")
        .eq("restaurant_id", restaurantId)
        .eq("status", "completed"),
    ]);

  // Map recognition event id -> guest id (for review attribution).
  const recGuest = new Map<string, string>();
  for (const r of recs ?? []) if (r.guest_id) recGuest.set(r.id, r.guest_id);

  // All dated events grouped by guest.
  const byGuest = new Map<string, DatedEvent[]>();
  const push = (e: DatedEvent) => {
    byGuest.set(e.guest_id, [...(byGuest.get(e.guest_id) ?? []), e]);
  };
  for (const c of claims ?? [])
    push({ guest_id: c.guest_id, type: "reward_claim", date: c.claimed_at, source_event_id: c.id });
  for (const v of returns ?? [])
    push({ guest_id: v.guest_id, type: "return_visit", date: v.created_at, source_event_id: v.id });
  for (const r of recs ?? [])
    if (r.guest_id)
      push({ guest_id: r.guest_id, type: "recognition", date: r.created_at, source_event_id: r.id });
  for (const rv of reviews ?? []) {
    const gid = recGuest.get(rv.recognition_event_id);
    if (gid && rv.completed_at)
      push({ guest_id: gid, type: "review", date: rv.completed_at, source_event_id: rv.id });
  }

  const audByCampaign = new Map<string, string[]>();
  for (const a of aud ?? [])
    audByCampaign.set(a.campaign_id, [...(audByCampaign.get(a.campaign_id) ?? []), a.guest_id]);

  const rows: Database["public"]["Tables"]["campaign_conversions"]["Insert"][] = [];
  for (const c of campaigns) {
    if (!c.sent_at) continue;
    const start = new Date(c.sent_at).getTime();
    const end = start + c.attribution_window_days * 86400_000;
    for (const guestId of audByCampaign.get(c.id) ?? []) {
      for (const e of byGuest.get(guestId) ?? []) {
        const t = new Date(e.date).getTime();
        if (t >= start && t <= end)
          rows.push({
            restaurant_id: restaurantId,
            campaign_id: c.id,
            guest_id: guestId,
            conversion_type: e.type,
            conversion_date: e.date,
            source_event_id: e.source_event_id,
          });
      }
    }
  }
  if (rows.length)
    await supabase
      .from("campaign_conversions")
      .upsert(rows, {
        onConflict: "campaign_id,guest_id,conversion_type,source_event_id",
        ignoreDuplicates: true,
      });

  // Materialize per-campaign value rollups (Sprint 7.6) from the final state.
  const { data: allConv } = await supabase
    .from("campaign_conversions")
    .select("campaign_id, conversion_type")
    .eq("restaurant_id", restaurantId);
  const roll = new Map<string, { rewards: number; returns: number; recs: number }>();
  for (const c of allConv ?? []) {
    const r = roll.get(c.campaign_id) ?? { rewards: 0, returns: 0, recs: 0 };
    if (c.conversion_type === "reward_claim") r.rewards++;
    else if (c.conversion_type === "return_visit") r.returns++;
    else if (c.conversion_type === "recognition") r.recs++;
    roll.set(c.campaign_id, r);
  }
  await Promise.all(
    campaigns.map((c) => {
      const r = roll.get(c.id) ?? { rewards: 0, returns: 0, recs: 0 };
      return supabase
        .from("campaigns")
        .update({
          attributed_rewards: r.rewards,
          attributed_return_visits: r.returns,
          attributed_recognitions: r.recs,
          estimated_revenue: estimateRevenue(r.returns, r.rewards),
        })
        .eq("id", c.id);
    }),
  );
}

export type CampaignListItem = Campaign & {
  templateName: string | null;
  kpis: CampaignKpis;
};

export type ChannelPerf = {
  channel: CampaignChannel;
  campaigns: number;
  audience: number;
  conversions: number;
  conversionRate: number | null;
};

export type TemplatePerf = {
  templateId: string;
  name: string;
  campaigns: number;
  audience: number;
  conversions: number;
  conversionRate: number | null;
};

export type CampaignIntelligence = {
  campaignsSent: number;
  guestsImpacted: number;
  rewardClaims: number;
  returnVisits: number;
  conversions: number;
  conversionRate: number | null;
  bestSegment: string | null;
  bestChannel: CampaignChannel | null;
  bestTemplate: string | null;
  channelPerf: ChannelPerf[];
  templatePerf: TemplatePerf[];
};

export async function getCampaigns(
  restaurantId: string,
): Promise<{ campaigns: CampaignListItem[]; intelligence: CampaignIntelligence }> {
  await syncCampaignConversions(restaurantId);
  const supabase = createAdminClient();
  const [{ data: rows }, { data: templates }, { data: recipients }, { data: conversions }, { data: audiences }] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false }),
      supabase.from("email_templates").select("id, name").eq("restaurant_id", restaurantId),
      supabase.from("campaign_recipients").select("campaign_id, status"),
      supabase
        .from("campaign_conversions")
        .select("campaign_id, guest_id, conversion_type")
        .eq("restaurant_id", restaurantId),
      supabase.from("campaign_audiences").select("campaign_id, guest_id"),
    ]);

  const tplName = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const recByCampaign = new Map<string, { status: string }[]>();
  for (const r of recipients ?? [])
    recByCampaign.set(r.campaign_id, [...(recByCampaign.get(r.campaign_id) ?? []), r]);
  const convByCampaign = new Map<string, { guest_id: string; conversion_type: ConversionType }[]>();
  for (const c of conversions ?? [])
    convByCampaign.set(c.campaign_id, [...(convByCampaign.get(c.campaign_id) ?? []), c]);

  const list: CampaignListItem[] = (rows ?? []).map((c) => ({
    ...c,
    templateName: c.template_id ? tplName.get(c.template_id) ?? null : null,
    kpis: computeCampaignKpis(
      c.audience_count,
      recByCampaign.get(c.id) ?? [],
      convByCampaign.get(c.id) ?? [],
    ),
  }));

  // ---- Intelligence rollups (over sent campaigns) ----
  const sent = list.filter((c) => c.status === "completed");
  const impacted = new Set((audiences ?? []).map((a) => a.guest_id)).size;
  const convertingGuests = new Set((conversions ?? []).map((c) => c.guest_id)).size;
  const totalAudience = sent.reduce((n, c) => n + c.audience_count, 0);

  const channelMap = new Map<CampaignChannel, ChannelPerf>();
  const templateMap = new Map<string, TemplatePerf>();
  let bestSegment: string | null = null;
  let bestSegmentRate = -1;
  for (const c of sent) {
    const conv = c.kpis.conversions;
    // channel
    const ch = channelMap.get(c.channel) ?? {
      channel: c.channel,
      campaigns: 0,
      audience: 0,
      conversions: 0,
      conversionRate: null,
    };
    ch.campaigns++;
    ch.audience += c.audience_count;
    ch.conversions += conv;
    channelMap.set(c.channel, ch);
    // template
    if (c.template_id) {
      const tp = templateMap.get(c.template_id) ?? {
        templateId: c.template_id,
        name: c.templateName ?? "—",
        campaigns: 0,
        audience: 0,
        conversions: 0,
        conversionRate: null,
      };
      tp.campaigns++;
      tp.audience += c.audience_count;
      tp.conversions += conv;
      templateMap.set(c.template_id, tp);
    }
    // best segment by campaign conversion rate
    if (c.kpis.conversionRate != null && c.kpis.conversionRate > bestSegmentRate) {
      bestSegmentRate = c.kpis.conversionRate;
      bestSegment = c.segment;
    }
  }
  const channelPerf = [...channelMap.values()].map((c) => ({
    ...c,
    conversionRate: c.audience ? c.conversions / c.audience : null,
  }));
  const templatePerf = [...templateMap.values()].map((t) => ({
    ...t,
    conversionRate: t.audience ? t.conversions / t.audience : null,
  }));
  const bestChannel =
    channelPerf.slice().sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0]?.channel ?? null;
  const bestTemplate =
    templatePerf.slice().sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0]?.name ?? null;

  return {
    campaigns: list,
    intelligence: {
      campaignsSent: sent.length,
      guestsImpacted: impacted,
      rewardClaims: sent.reduce((n, c) => n + c.kpis.rewardClaims, 0),
      returnVisits: sent.reduce((n, c) => n + c.kpis.returnVisits, 0),
      conversions: convertingGuests,
      conversionRate: totalAudience ? convertingGuests / totalAudience : null,
      bestSegment,
      bestChannel,
      bestTemplate,
      channelPerf,
      templatePerf,
    },
  };
}

export type CampaignRecipientRow = {
  guestId: string;
  name: string | null;
  email: string | null;
  status: string;
  reason: string | null;
};

export type CampaignConversionRow = {
  guestId: string;
  name: string | null;
  type: ConversionType;
  date: string;
};

export type CampaignDetail = {
  campaign: Campaign;
  templateName: string | null;
  kpis: CampaignKpis;
  recipients: CampaignRecipientRow[];
  conversions: CampaignConversionRow[];
};

export async function getCampaign(
  restaurantId: string,
  campaignId: string,
): Promise<CampaignDetail | null> {
  await syncCampaignConversions(restaurantId);
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!campaign) return null;

  const [{ data: recs }, { data: convs }, tpl] = await Promise.all([
    supabase
      .from("campaign_recipients")
      .select("guest_id, status, reason, guests(name, email)")
      .eq("campaign_id", campaignId),
    supabase
      .from("campaign_conversions")
      .select("guest_id, conversion_type, conversion_date, guests(name)")
      .eq("campaign_id", campaignId)
      .order("conversion_date", { ascending: false }),
    campaign.template_id
      ? supabase.from("email_templates").select("name").eq("id", campaign.template_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recipients: CampaignRecipientRow[] = (
    (recs as unknown as {
      guest_id: string;
      status: string;
      reason: string | null;
      guests: { name: string | null; email: string | null } | null;
    }[]) ?? []
  ).map((r) => ({
    guestId: r.guest_id,
    name: r.guests?.name ?? null,
    email: r.guests?.email ?? null,
    status: r.status,
    reason: r.reason,
  }));

  const conversions: CampaignConversionRow[] = (
    (convs as unknown as {
      guest_id: string;
      conversion_type: ConversionType;
      conversion_date: string;
      guests: { name: string | null } | null;
    }[]) ?? []
  ).map((c) => ({
    guestId: c.guest_id,
    name: c.guests?.name ?? null,
    type: c.conversion_type,
    date: c.conversion_date,
  }));

  return {
    campaign,
    templateName: (tpl?.data as { name: string } | null)?.name ?? null,
    kpis: computeCampaignKpis(
      campaign.audience_count,
      recipients.map((r) => ({ status: r.status })),
      conversions.map((c) => ({ guest_id: c.guestId, conversion_type: c.type })),
    ),
    recipients,
    conversions,
  };
}

export type GuestCommunication = {
  campaignId: string;
  name: string;
  channel: CampaignChannel;
  sentAt: string | null;
  status: string;
  conversions: ConversionType[];
};

export async function getGuestCommunications(
  guestId: string,
): Promise<GuestCommunication[]> {
  const supabase = createAdminClient();
  const { data: recs } = await supabase
    .from("campaign_recipients")
    .select("campaign_id, status, channel, campaigns(name, sent_at)")
    .eq("guest_id", guestId);
  if (!recs || recs.length === 0) return [];

  const { data: convs } = await supabase
    .from("campaign_conversions")
    .select("campaign_id, conversion_type")
    .eq("guest_id", guestId);
  const convByCampaign = new Map<string, ConversionType[]>();
  for (const c of convs ?? [])
    convByCampaign.set(c.campaign_id, [
      ...(convByCampaign.get(c.campaign_id) ?? []),
      c.conversion_type,
    ]);

  return (
    recs as unknown as {
      campaign_id: string;
      status: string;
      channel: CampaignChannel;
      campaigns: { name: string; sent_at: string | null } | null;
    }[]
  )
    .map((r) => ({
      campaignId: r.campaign_id,
      name: r.campaigns?.name ?? "—",
      channel: r.channel,
      sentAt: r.campaigns?.sent_at ?? null,
      status: r.status,
      conversions: convByCampaign.get(r.campaign_id) ?? [],
    }))
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
}

// ===========================================================================
// Sprint 7.6 — Campaign ROI / Intelligence hub
// ===========================================================================

export type SegmentPerfRow = {
  segment: string;
  label: string;
  campaigns: number;
  audience: number;
  conversions: number;
  conversionRate: number | null;
  returnVisits: number;
  rewardClaims: number;
};

export type TemplatePerfRow = {
  templateId: string;
  name: string;
  campaigns: number;
  audience: number;
  conversions: number;
  conversionRate: number | null;
  returnVisits: number;
  rewardClaims: number;
};

export type TopGuest = {
  id: string;
  name: string | null;
  recognitions: number;
  rewards: number;
  returnVisits: number;
  engagement: number;
};

export type TopRecoveryCampaign = {
  id: string;
  name: string;
  segment: string;
  recovered: number;
  estimatedRevenue: number;
};

export type Intelligence = {
  segmentPerf: SegmentPerfRow[];
  channelPerf: ChannelPerf[];
  templatePerf: TemplatePerfRow[];
  topGuests: { engagement: TopGuest[]; returning: TopGuest[]; rewards: TopGuest[] };
  topRecoveryCampaigns: TopRecoveryCampaign[];
  topStaff: StaffImpactRow[];
  totalEstimatedRevenue: number;
};

export async function getIntelligence(
  restaurantId: string,
): Promise<Intelligence> {
  const [{ campaigns }, { guests }, staff] = await Promise.all([
    getCampaigns(restaurantId),
    getCrmData(restaurantId),
    getStaffImpact(restaurantId),
  ]);
  const sent = campaigns.filter((c) => c.status === "completed");

  // ---- Segment performance ----
  const segMap = new Map<string, SegmentPerfRow>();
  for (const c of sent) {
    const s = segMap.get(c.segment) ?? {
      segment: c.segment,
      label: segmentLabel(c.segment),
      campaigns: 0,
      audience: 0,
      conversions: 0,
      conversionRate: null,
      returnVisits: 0,
      rewardClaims: 0,
    };
    s.campaigns++;
    s.audience += c.audience_count;
    s.conversions += c.kpis.conversions;
    s.returnVisits += c.kpis.returnVisits;
    s.rewardClaims += c.kpis.rewardClaims;
    segMap.set(c.segment, s);
  }
  const segmentPerf = [...segMap.values()]
    .map((s) => ({ ...s, conversionRate: s.audience ? s.conversions / s.audience : null }))
    .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0));

  // ---- Channel performance ----
  const chMap = new Map<CampaignChannel, ChannelPerf>();
  for (const c of sent) {
    const ch = chMap.get(c.channel) ?? {
      channel: c.channel,
      campaigns: 0,
      audience: 0,
      conversions: 0,
      conversionRate: null,
    };
    ch.campaigns++;
    ch.audience += c.audience_count;
    ch.conversions += c.kpis.conversions;
    chMap.set(c.channel, ch);
  }
  const channelPerf = [...chMap.values()].map((c) => ({
    ...c,
    conversionRate: c.audience ? c.conversions / c.audience : null,
  }));

  // ---- Template performance ----
  const tplMap = new Map<string, TemplatePerfRow>();
  for (const c of sent) {
    if (!c.template_id) continue;
    const t = tplMap.get(c.template_id) ?? {
      templateId: c.template_id,
      name: c.templateName ?? "—",
      campaigns: 0,
      audience: 0,
      conversions: 0,
      conversionRate: null,
      returnVisits: 0,
      rewardClaims: 0,
    };
    t.campaigns++;
    t.audience += c.audience_count;
    t.conversions += c.kpis.conversions;
    t.returnVisits += c.kpis.returnVisits;
    t.rewardClaims += c.kpis.rewardClaims;
    tplMap.set(c.template_id, t);
  }
  const templatePerf = [...tplMap.values()]
    .map((t) => ({ ...t, conversionRate: t.audience ? t.conversions / t.audience : null }))
    .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0));

  // ---- Top guests ----
  const guestValues: TopGuest[] = guests.map((g) => ({
    id: g.id,
    name: g.name,
    recognitions: g.recognitionEvents,
    rewards: g.rewardsClaimed,
    returnVisits: g.returnVisits,
    engagement: engagementScore({
      recognitions: g.recognitionEvents,
      rewardsClaimed: g.rewardsClaimed,
      returnVisits: g.returnVisits,
    }),
  }));
  const top = (arr: TopGuest[], key: (g: TopGuest) => number) =>
    arr
      .filter((g) => key(g) > 0)
      .sort((a, b) => key(b) - key(a))
      .slice(0, 5);

  // ---- Top recovery campaigns ----
  const topRecoveryCampaigns: TopRecoveryCampaign[] = sent
    .filter((c) => c.kpis.returnVisits > 0)
    .sort((a, b) => b.kpis.returnVisits - a.kpis.returnVisits)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      segment: segmentLabel(c.segment),
      recovered: c.kpis.returnVisits,
      estimatedRevenue: c.estimated_revenue,
    }));

  const topStaff = staff
    .slice()
    .sort(
      (a, b) =>
        b.recoveredGuests - a.recoveredGuests ||
        b.returnVisits - a.returnVisits ||
        b.recognitionEvents - a.recognitionEvents,
    )
    .slice(0, 5);

  return {
    segmentPerf,
    channelPerf,
    templatePerf,
    topGuests: {
      engagement: top(guestValues, (g) => g.engagement),
      returning: top(guestValues, (g) => g.returnVisits),
      rewards: top(guestValues, (g) => g.rewards),
    },
    topRecoveryCampaigns,
    topStaff,
    totalEstimatedRevenue: sent.reduce((n, c) => n + c.estimated_revenue, 0),
  };
}

// ===========================================================================
// Sprint 8A — Email activation: recent logs for the readiness console
// ===========================================================================

export type EmailLogRow = {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
};

export async function getRecentEmailLogs(
  restaurantId: string,
  limit = 15,
): Promise<EmailLogRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("email_logs")
    .select("id, recipient_email, subject, status, provider_message_id, error_message, retry_count, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
