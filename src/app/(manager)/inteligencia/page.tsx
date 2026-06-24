import Link from "next/link";

import { Card } from "@/components/ui/card";
import { CHANNEL_LABEL } from "@/lib/campaigns";
import { getCurrentRestaurant, getIntelligence, type TopGuest } from "@/lib/queries";

export const dynamic = "force-dynamic";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const ars = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function InteligenciaPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const intel = await getIntelligence(restaurant.id);

  const hasData =
    intel.segmentPerf.length > 0 ||
    intel.topRecoveryCampaigns.length > 0 ||
    intel.topGuests.engagement.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Inteligencia</h1>
        <p className="mt-1 text-sm text-muted">
          Qué campañas funcionan, qué segmentos convierten, qué clientes valen más.
        </p>
      </header>

      {/* Estimated revenue (placeholder) */}
      <Card className="mb-8 border-pink/30 bg-pink/5 p-5">
        <p className="text-xs font-medium text-muted">
          Revenue estimado de campañas{" "}
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">
            placeholder
          </span>
        </p>
        <p className="mt-1 text-3xl font-bold text-pink">{ars(intel.totalEstimatedRevenue)}</p>
        <p className="mt-1 text-xs text-muted">
          Estimación a partir de return visits y rewards atribuidas. No es revenue
          real (sin POS ni pagos integrados todavía).
        </p>
      </Card>

      {!hasData ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-muted">
            Todavía no hay campañas con resultados.{" "}
            <Link href="/campanas/nueva" className="font-medium text-pink">
              Creá una campaña
            </Link>{" "}
            para empezar a medir.
          </p>
        </Card>
      ) : null}

      {/* Segment performance */}
      {intel.segmentPerf.length > 0 && (
        <Section title="Performance por segmento" subtitle="Segmentos de alto rendimiento">
          <PerfTable
            head={["Segmento", "Camp.", "Audiencia", "Conv. rate", "Return visits", "Rewards"]}
            rows={intel.segmentPerf.map((s) => [
              s.label,
              s.campaigns,
              s.audience,
              pct(s.conversionRate),
              s.returnVisits,
              s.rewardClaims,
            ])}
          />
        </Section>
      )}

      {/* Channel + Template performance */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {intel.channelPerf.length > 0 && (
          <Section title="Performance por canal" subtitle="Email vs WhatsApp">
            <PerfTable
              head={["Canal", "Camp.", "Audiencia", "Conv. rate"]}
              rows={intel.channelPerf.map((c) => [
                CHANNEL_LABEL[c.channel],
                c.campaigns,
                c.audience,
                pct(c.conversionRate),
              ])}
            />
          </Section>
        )}
        {intel.templatePerf.length > 0 && (
          <Section title="Performance por plantilla" subtitle="Qué mensajes generan retorno">
            <PerfTable
              head={["Plantilla", "Conv. rate", "Return visits", "Rewards"]}
              rows={intel.templatePerf.map((t) => [
                t.name,
                pct(t.conversionRate),
                t.returnVisits,
                t.rewardClaims,
              ])}
            />
          </Section>
        )}
      </div>

      {/* Top guests */}
      <Section title="Top clientes" subtitle="Quiénes tienen más valor">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TopGuestList title="Mayor engagement" guests={intel.topGuests.engagement} metric={(g) => g.engagement} />
          <TopGuestList title="Más recurrentes" guests={intel.topGuests.returning} metric={(g) => g.returnVisits} suffix=" visitas" />
          <TopGuestList title="Más rewards" guests={intel.topGuests.rewards} metric={(g) => g.rewards} />
        </div>
      </Section>

      {/* Top recovery campaigns + Top staff */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Top campañas de recuperación" subtitle="Las que más clientes recuperaron">
          {intel.topRecoveryCampaigns.length === 0 ? (
            <Card><p className="text-sm text-muted">Sin datos todavía.</p></Card>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-border/60">
                {intel.topRecoveryCampaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <Link href={`/campanas/${c.id}`} className="text-sm font-medium text-dark hover:text-pink">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted">{c.segment} · {ars(c.estimatedRevenue)} est.</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-pink">{c.recovered}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </Section>

        <Section title="Top staff impact" subtitle="Quién genera más relación y recuperación">
          {intel.topStaff.length === 0 ? (
            <Card><p className="text-sm text-muted">Sin datos todavía.</p></Card>
          ) : (
            <Card className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2">Camarero</th>
                    <th className="px-4 py-2">Recon.</th>
                    <th className="px-4 py-2">Return v.</th>
                    <th className="px-4 py-2">Recuperados</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.topStaff.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 font-medium text-dark">{s.name}</td>
                      <td className="px-4 py-2 text-muted">{s.recognitionEvents}</td>
                      <td className="px-4 py-2 text-muted">{s.returnVisits}</td>
                      <td className="px-4 py-2 font-semibold text-pink">{s.recoveredGuests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-dark">{title}</h2>
        {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function PerfTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <Card className="p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={j === 0 ? "px-4 py-2 font-medium text-dark" : "px-4 py-2 text-muted"}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TopGuestList({
  title,
  guests,
  metric,
  suffix = "",
}: {
  title: string;
  guests: TopGuest[];
  metric: (g: TopGuest) => number;
  suffix?: string;
}) {
  return (
    <Card className="p-0">
      <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-dark">{title}</p>
      {guests.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted">Sin datos.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {guests.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <Link href={`/clientes/${g.id}`} className="truncate text-sm text-dark hover:text-pink">
                {g.name ?? "—"}
              </Link>
              <span className="shrink-0 text-sm font-semibold text-pink">
                {metric(g)}{suffix}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
