import "server-only";

import { fetchAllRows } from "@/lib/queries";
import { unsafeAdminClient } from "@/lib/supabase/admin";

import { getPaymentProvider } from "./mercadopago";

// =============================================================================
// Payment read models — the Payment Dashboard (manager) + Staff tips dashboard.
// =============================================================================

type PaymentRow = {
  id: string;
  staff_id: string | null;
  amount: number;
  status: string;
  payment_method: string | null;
  tip_source: string;
  created_at: string;
  completed_at: string | null;
};

const DAY = 86_400_000;

export type PaymentDashboard = {
  totalToday: number;
  totalWeek: number;
  totalMonth: number;
  avgTip: number | null;
  approvedCount: number;
  approvalRate: number | null;
  rejectionRate: number | null;
  avgApprovalMs: number | null;
  topStaff: { staffId: string; name: string; total: number; count: number }[];
  methods: { method: string; count: number }[];
  recent: {
    id: string;
    staff: string | null;
    amount: number;
    status: string;
    source: string;
    method: string | null;
    created_at: string;
  }[];
  health: { ok: boolean; sandbox: boolean; configured: boolean; latencyMs: number; message: string };
};

export async function getPaymentDashboard(
  restaurantId: string,
): Promise<PaymentDashboard> {
  const supabase = unsafeAdminClient();
  const [payments, staffRows, health] = await Promise.all([
    fetchAllRows<PaymentRow>((f, t) =>
      supabase
        .from("payments")
        .select("id, staff_id, amount, status, payment_method, tip_source, created_at, completed_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    supabase.from("staff").select("id, name").eq("restaurant_id", restaurantId),
    getPaymentProvider().health(),
  ]);
  const provider = getPaymentProvider();
  const staffName = new Map((staffRows.data ?? []).map((s) => [s.id, s.name]));

  const approved = payments.filter((p) => p.status === "approved");
  const rejected = payments.filter((p) => p.status === "rejected");
  const now = Date.now();
  const when = (p: PaymentRow) => new Date(p.completed_at ?? p.created_at).getTime();
  const sumSince = (ms: number) =>
    approved.filter((p) => when(p) >= now - ms).reduce((n, p) => n + Number(p.amount), 0);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const avgTip = approved.length
    ? approved.reduce((n, p) => n + Number(p.amount), 0) / approved.length
    : null;
  const decided = approved.length + rejected.length;

  const staffAgg = new Map<string, { total: number; count: number }>();
  for (const p of approved) {
    if (!p.staff_id) continue;
    const a = staffAgg.get(p.staff_id) ?? { total: 0, count: 0 };
    a.total += Number(p.amount); a.count += 1;
    staffAgg.set(p.staff_id, a);
  }
  const topStaff = [...staffAgg.entries()]
    .map(([staffId, a]) => ({ staffId, name: staffName.get(staffId) ?? "—", ...a }))
    .sort((x, y) => y.total - x.total)
    .slice(0, 5);

  const methodAgg = new Map<string, number>();
  for (const p of approved) {
    const m = p.payment_method ?? "—";
    methodAgg.set(m, (methodAgg.get(m) ?? 0) + 1);
  }

  const approvalTimes = approved
    .filter((p) => p.completed_at)
    .map((p) => new Date(p.completed_at!).getTime() - new Date(p.created_at).getTime())
    .filter((ms) => ms >= 0);
  const avgApprovalMs = approvalTimes.length
    ? Math.round(approvalTimes.reduce((n, m) => n + m, 0) / approvalTimes.length)
    : null;

  return {
    totalToday: approved.filter((p) => when(p) >= startOfToday.getTime()).reduce((n, p) => n + Number(p.amount), 0),
    totalWeek: sumSince(7 * DAY),
    totalMonth: sumSince(30 * DAY),
    avgTip,
    approvedCount: approved.length,
    approvalRate: decided ? approved.length / decided : null,
    rejectionRate: decided ? rejected.length / decided : null,
    avgApprovalMs,
    topStaff,
    methods: [...methodAgg.entries()].map(([method, count]) => ({ method, count })),
    recent: payments.slice(0, 20).map((p) => ({
      id: p.id,
      staff: p.staff_id ? staffName.get(p.staff_id) ?? null : null,
      amount: Number(p.amount),
      status: p.status,
      source: p.tip_source,
      method: p.payment_method,
      created_at: p.created_at,
    })),
    health: {
      ok: health.ok,
      sandbox: provider.sandbox,
      configured: provider.configured,
      latencyMs: health.latencyMs,
      message: health.message,
    },
  };
}

export type StaffTips = {
  staffId: string;
  name: string;
  today: number;
  week: number;
  month: number;
  count: number;
  avg: number | null;
};

export async function getStaffTips(restaurantId: string): Promise<StaffTips[]> {
  const supabase = unsafeAdminClient();
  const [payments, staffRows] = await Promise.all([
    fetchAllRows<PaymentRow>((f, t) =>
      supabase
        .from("payments")
        .select("id, staff_id, amount, status, payment_method, tip_source, created_at, completed_at")
        .eq("restaurant_id", restaurantId)
        .eq("status", "approved")
        .range(f, t),
    ),
    supabase.from("staff").select("id, name").eq("restaurant_id", restaurantId).neq("status", "archived"),
  ]);
  const now = Date.now();
  const when = (p: PaymentRow) => new Date(p.completed_at ?? p.created_at).getTime();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  return (staffRows.data ?? [])
    .map((s) => {
      const mine = payments.filter((p) => p.staff_id === s.id);
      const sum = (pred: (p: PaymentRow) => boolean) =>
        mine.filter(pred).reduce((n, p) => n + Number(p.amount), 0);
      const total = sum(() => true);
      return {
        staffId: s.id,
        name: s.name,
        today: sum((p) => when(p) >= startOfToday.getTime()),
        week: sum((p) => when(p) >= now - 7 * DAY),
        month: sum((p) => when(p) >= now - 30 * DAY),
        count: mine.length,
        avg: mine.length ? total / mine.length : null,
      };
    })
    .sort((a, b) => b.month - a.month);
}
