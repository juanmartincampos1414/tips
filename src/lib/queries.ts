import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

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
