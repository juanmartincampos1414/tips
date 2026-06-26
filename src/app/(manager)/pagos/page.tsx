import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { getCurrentMembership } from "@/lib/auth";
import { getPaymentDashboard, getStaffTips } from "@/lib/payments/queries";
import { PAYMENT_STATUS_LABEL, TIP_SOURCE_LABEL, type PaymentStatus, type TipSource } from "@/lib/payments/types";
import { getCurrentRestaurant } from "@/lib/queries";

import { createSandboxTip, refundPaymentAction, retryPaymentAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

const STATUS_CLS: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-amber-100 text-amber-700",
  rejected: "bg-pink/10 text-pink",
  expired: "bg-pink/10 text-pink",
  cancelled: "bg-muted/15 text-muted",
  refunded: "bg-dark/10 text-dark/60",
  chargeback: "bg-pink/10 text-pink",
};

export default async function PagosPage() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") redirect("/dashboard");

  const restaurant = (await getCurrentRestaurant())!;
  const [d, staffTips] = await Promise.all([
    getPaymentDashboard(restaurant.id),
    getStaffTips(restaurant.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Pagos</h1>
        <p className="mt-1 text-sm text-muted">Propinas reales vía Mercado Pago.</p>
      </header>

      {/* Health */}
      <Card className={`mb-6 p-4 ${d.health.configured ? "border-success/30 bg-success/5" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${d.health.configured ? "text-success" : "text-amber-700"}`}>
            Mercado Pago · {d.health.sandbox ? "Sandbox" : "Producción"} ·{" "}
            {d.health.configured ? "configurado" : "sin credenciales (MP_ACCESS_TOKEN)"}
          </p>
          <p className="text-xs text-muted">
            {d.health.message} · latencia {d.health.latencyMs}ms · health{" "}
            {d.health.ok ? "100" : "0"}%
          </p>
        </div>
      </Card>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Hoy" value={money(d.totalToday)} highlight />
        <Kpi label="Semana" value={money(d.totalWeek)} />
        <Kpi label="Mes" value={money(d.totalMonth)} />
        <Kpi label="Propina prom." value={d.avgTip == null ? "—" : money(d.avgTip)} />
        <Kpi label="Aprobación" value={pct(d.approvalRate)} />
        <Kpi label="Rechazo" value={pct(d.rejectionRate)} />
      </div>
      <p className="mb-6 text-xs text-muted">
        {d.approvedCount} pagos aprobados · tiempo prom. de aprobación{" "}
        {d.avgApprovalMs == null ? "—" : `${(d.avgApprovalMs / 1000).toFixed(1)}s`}
      </p>

      {/* Sandbox trigger */}
      <Card className="mb-8 p-4">
        <p className="text-sm font-semibold text-dark">Probar checkout (sandbox)</p>
        <p className="mb-3 text-xs text-muted">
          Crea una propina de prueba y abre el checkout simulado (aprobar/rechazar
          → webhook → confirma reconocimiento + settlement).
        </p>
        <form action={createSandboxTip} className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Monto (ARS)</label>
            <input name="amount" type="number" defaultValue={2000} className="h-9 w-32 rounded-lg border border-border bg-card px-3 text-sm text-dark outline-none focus:border-pink" />
          </div>
          <button className="h-9 rounded-lg bg-pink px-4 text-sm font-semibold text-white hover:opacity-90">
            Crear cobro de prueba
          </button>
        </form>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top staff */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">Top staff (propinas)</h2>
          <Card className="p-0">
            {d.topStaff.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sin propinas aprobadas todavía.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {d.topStaff.map((s) => (
                  <li key={s.staffId} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-dark">{s.name}</span>
                    <span className="text-dark">{money(s.total)} <span className="text-xs text-muted">({s.count})</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Methods */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">Métodos de pago</h2>
          <Card className="p-0">
            {d.methods.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sin datos.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {d.methods.map((m) => (
                  <li key={m.method} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-dark">{m.method}</span>
                    <span className="text-muted">{m.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {/* Recent payments */}
      <h2 className="mb-2 text-sm font-semibold text-dark">Pagos recientes</h2>
      <Card className="mb-8 p-0">
        {d.recent.length === 0 ? (
          <p className="p-5 text-sm text-muted">Sin pagos todavía.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Monto</th>
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Origen</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-medium text-dark">{money(p.amount)}</td>
                  <td className="px-4 py-2 text-muted">{p.staff ?? "—"}</td>
                  <td className="px-4 py-2 text-muted">{TIP_SOURCE_LABEL[p.source as TipSource] ?? p.source}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[p.status] ?? "bg-muted/15 text-muted"}`}>
                      {PAYMENT_STATUS_LABEL[p.status as PaymentStatus] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {["rejected", "expired", "pending", "processing"].includes(p.status) ? (
                      <form action={retryPaymentAction} className="inline">
                        <input type="hidden" name="payment_id" value={p.id} />
                        <button className="text-xs font-medium text-pink hover:underline">Reintentar</button>
                      </form>
                    ) : p.status === "approved" ? (
                      <form action={refundPaymentAction} className="inline">
                        <input type="hidden" name="payment_id" value={p.id} />
                        <ConfirmSubmit message="¿Reembolsar este pago?" className="text-xs font-medium text-muted hover:text-pink">
                          Reembolsar
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Staff tips dashboard */}
      <h2 className="mb-2 text-sm font-semibold text-dark">Propinas por camarero</h2>
      <Card className="p-0">
        {staffTips.length === 0 ? (
          <p className="p-5 text-sm text-muted">Sin camareros.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Camarero</th>
                <th className="px-4 py-2">Hoy</th>
                <th className="px-4 py-2">Semana</th>
                <th className="px-4 py-2">Mes</th>
                <th className="px-4 py-2">Cantidad</th>
                <th className="px-4 py-2">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {staffTips.map((s) => (
                <tr key={s.staffId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-medium text-dark">{s.name}</td>
                  <td className="px-4 py-2 text-muted">{money(s.today)}</td>
                  <td className="px-4 py-2 text-muted">{money(s.week)}</td>
                  <td className="px-4 py-2 font-medium text-dark">{money(s.month)}</td>
                  <td className="px-4 py-2 text-muted">{s.count}</td>
                  <td className="px-4 py-2 text-muted">{s.avg == null ? "—" : money(s.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-pink/30 bg-pink/5 p-4" : "p-4"}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-pink" : "text-dark"}`}>{value}</p>
    </Card>
  );
}
