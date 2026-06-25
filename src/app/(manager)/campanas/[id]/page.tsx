import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import {
  CHANNEL_LABEL,
  CONVERSION_LABEL,
  segmentLabel,
  STATUS_CLS,
  STATUS_LABEL,
} from "@/lib/campaigns";
import { getCampaign, getCurrentRestaurant } from "@/lib/queries";

import { archiveCampaign, sendCampaign } from "../actions";

export const dynamic = "force-dynamic";
// Sending to a large audience writes/dispatches in batches.
export const maxDuration = 300;

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const ars = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const REC_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  delivered: "bg-success/15 text-success",
  opened: "bg-success/15 text-success",
  clicked: "bg-success/15 text-success",
  failed: "bg-pink/10 text-pink",
  skipped: "bg-muted/15 text-muted",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = (await getCurrentRestaurant())!;
  const detail = await getCampaign(restaurant.id, id);
  if (!detail) notFound();

  const { campaign: c, templateName, kpis, recipients, conversions } = detail;
  const isDraft = c.status === "draft";

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/campanas" className="text-sm font-medium text-muted hover:text-dark">
        ← Volver a campañas
      </Link>

      <header className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">{c.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {CHANNEL_LABEL[c.channel]} · {segmentLabel(c.segment)} ·{" "}
            {templateName ?? "Sin plantilla"} · ventana {c.attribution_window_days}d
          </p>
          {c.description ? <p className="mt-1 text-sm text-dark">{c.description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLS[c.status]}`}>
            {STATUS_LABEL[c.status]}
          </span>
          {isDraft ? (
            <form action={sendCampaign}>
              <input type="hidden" name="id" value={c.id} />
              <button
                type="submit"
                className="rounded-full bg-pink px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Enviar a {c.audience_count}
              </button>
            </form>
          ) : c.status !== "archived" ? (
            <form action={archiveCampaign}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="text-xs font-medium text-muted hover:text-pink">
                Archivar
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {isDraft ? (
        <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200">
          Campaña en <strong>borrador</strong>. Al enviar se congela la audiencia
          ({c.audience_count} contactables), se registran los envíos y empieza la
          atribución de conversiones por {c.attribution_window_days} días.
        </div>
      ) : null}

      {/* Performance KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Audiencia" value={kpis.audience} />
        <Kpi label="Entregados" value={kpis.delivered} />
        <Kpi label="Aperturas" value={kpis.opened} />
        <Kpi label="Clics" value={kpis.clicked} />
        <Kpi label="Open rate" value={pct(kpis.openRate)} />
        <Kpi label="Click rate" value={pct(kpis.clickRate)} />
        <Kpi label="Rewards reclamadas" value={kpis.rewardClaims} />
        <Kpi label="Return visits" value={kpis.returnVisits} />
        <Kpi label="Reviews" value={kpis.reviews} />
        <Kpi label="Recognition" value={kpis.recognitions} />
        <Kpi label="Conversiones" value={kpis.conversions} />
        <Kpi label="Conversion rate" value={pct(kpis.conversionRate)} highlight />
      </div>

      {/* Campaign value (Sprint 7.6 — placeholder economics) */}
      {!isDraft ? (
        <Card className="mb-6 border-pink/30 bg-pink/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted">
                Revenue estimado{" "}
                <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">
                  placeholder
                </span>
              </p>
              <p className="mt-1 text-2xl font-bold text-pink">{ars(c.estimated_revenue)}</p>
            </div>
            <div className="flex gap-5 text-sm">
              <ValueStat label="Return visits" value={c.attributed_return_visits} />
              <ValueStat label="Rewards" value={c.attributed_rewards} />
              <ValueStat label="Recognitions" value={c.attributed_recognitions} />
            </div>
          </div>
        </Card>
      ) : null}

      {!isDraft && kpis.delivered === 0 && kpis.failed > 0 ? (
        <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 ring-1 ring-amber-200">
          Los envíos quedaron en modo mock (sin proveedor / sin entrega real), por
          eso las métricas de entrega y apertura están en 0. La atribución de
          conversiones (return visits, rewards, etc.) sí funciona sobre la
          audiencia.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Conversions */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">
            Conversiones ({conversions.length})
          </h2>
          <Card className="p-0">
            {conversions.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sin conversiones atribuidas todavía.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {conversions.map((cv, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-dark">{cv.name ?? "—"}</p>
                      <p className="text-xs text-muted">{CONVERSION_LABEL[cv.type]}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{dt(cv.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Recipients */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dark">
            Destinatarios ({recipients.length})
          </h2>
          <Card className="p-0">
            {recipients.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sin destinatarios (todavía no se envió).</p>
            ) : (
              <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto">
                {recipients.map((r) => (
                  <li key={r.guestId} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-dark">{r.name ?? "—"}</p>
                      <p className="truncate text-xs text-muted">{r.email ?? "—"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${REC_CLS[r.status] ?? "bg-muted/15 text-muted"}`}>
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-pink/30 bg-pink/5 p-3" : "p-3"}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-pink" : "text-dark"}`}>{value}</p>
    </Card>
  );
}

function ValueStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-dark">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
