import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  CHANNEL_LABEL,
  segmentLabel,
  STATUS_CLS,
  STATUS_LABEL,
} from "@/lib/campaigns";
import { getCampaigns, getCurrentRestaurant } from "@/lib/queries";

export const dynamic = "force-dynamic";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export default async function CampanasPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const { campaigns, intelligence: intel } = await getCampaigns(restaurant.id);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Campañas</h1>
          <p className="mt-1 text-sm text-muted">
            Comunicá, medí y entendé qué genera retorno.
          </p>
        </div>
        <Link
          href="/campanas/nueva"
          className="rounded-full bg-pink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          + Nueva campaña
        </Link>
      </header>

      {/* Campaign Intelligence */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-dark">Campaign Intelligence</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Campañas enviadas" value={intel.campaignsSent} />
          <Kpi label="Clientes impactados" value={intel.guestsImpacted} />
          <Kpi label="Rewards reclamadas" value={intel.rewardClaims} />
          <Kpi label="Return visits" value={intel.returnVisits} />
          <Kpi label="Conversiones" value={intel.conversions} />
          <Kpi label="Conversion rate" value={pct(intel.conversionRate)} highlight />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Best label="Mejor segmento" value={intel.bestSegment ? segmentLabel(intel.bestSegment) : "—"} />
          <Best label="Mejor canal" value={intel.bestChannel ? CHANNEL_LABEL[intel.bestChannel] : "—"} />
          <Best label="Mejor plantilla" value={intel.bestTemplate ?? "—"} />
        </div>
      </section>

      {/* Channel + template performance */}
      {(intel.channelPerf.length > 0 || intel.templatePerf.length > 0) && (
        <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {intel.channelPerf.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-dark">Performance por canal</h3>
              <Card className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">Canal</th>
                      <th className="px-4 py-2">Camp.</th>
                      <th className="px-4 py-2">Audiencia</th>
                      <th className="px-4 py-2">Conv. rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intel.channelPerf.map((c) => (
                      <tr key={c.channel} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 font-medium text-dark">{CHANNEL_LABEL[c.channel]}</td>
                        <td className="px-4 py-2 text-muted">{c.campaigns}</td>
                        <td className="px-4 py-2 text-muted">{c.audience}</td>
                        <td className="px-4 py-2 font-semibold text-dark">{pct(c.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
          {intel.templatePerf.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-dark">Performance por plantilla</h3>
              <Card className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">Plantilla</th>
                      <th className="px-4 py-2">Camp.</th>
                      <th className="px-4 py-2">Audiencia</th>
                      <th className="px-4 py-2">Conv. rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intel.templatePerf.map((t) => (
                      <tr key={t.templateId} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 font-medium text-dark">{t.name}</td>
                        <td className="px-4 py-2 text-muted">{t.campaigns}</td>
                        <td className="px-4 py-2 text-muted">{t.audience}</td>
                        <td className="px-4 py-2 font-semibold text-dark">{pct(t.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </section>
      )}

      {/* Campaign list */}
      <h2 className="mb-3 text-sm font-semibold text-dark">Todas las campañas ({campaigns.length})</h2>
      {campaigns.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Todavía no creaste campañas.{" "}
            <Link href="/campanas/nueva" className="font-medium text-pink">
              Creá la primera
            </Link>
            .
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-5 py-3">Campaña</th>
                <th className="px-5 py-3">Canal</th>
                <th className="px-5 py-3">Segmento</th>
                <th className="px-5 py-3">Audiencia</th>
                <th className="px-5 py-3">Conversiones</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-dark">{c.name}</td>
                  <td className="px-5 py-3 text-muted">{CHANNEL_LABEL[c.channel]}</td>
                  <td className="px-5 py-3 text-muted">{segmentLabel(c.segment)}</td>
                  <td className="px-5 py-3 text-muted">{c.audience_count}</td>
                  <td className="px-5 py-3 font-semibold text-dark">
                    {c.kpis.conversions}{" "}
                    <span className="text-xs font-normal text-muted">({pct(c.kpis.conversionRate)})</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/campanas/${c.id}`} className="text-sm font-medium text-pink hover:opacity-80">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-pink/30 bg-pink/5 p-4" : "p-4"}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-pink" : "text-dark"}`}>{value}</p>
    </Card>
  );
}

function Best({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-dark">{value}</p>
    </Card>
  );
}
