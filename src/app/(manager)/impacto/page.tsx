import { Card } from "@/components/ui/card";
import { getCurrentRestaurant, getStaffImpact } from "@/lib/queries";

export default async function ImpactoPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const impact = await getStaffImpact(restaurant.id);
  // Order by relationship generated (return visits, then recognition).
  impact.sort(
    (a, b) =>
      b.returnVisits - a.returnVisits ||
      b.recognitionEvents - a.recognitionEvents,
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            Staff Impact
          </h1>
          <p className="mt-1 text-sm text-muted">
            Qué miembros del equipo generan más relación y recurrencia.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/export/staff_impact"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-dark hover:bg-background"
        >
          Exportar CSV
        </a>
      </header>

      {impact.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-muted">Todavía no hay camareros.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Camarero</th>
                <th className="px-4 py-3 font-medium">Recon.</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Reviews</th>
                <th className="px-4 py-3 font-medium">Capturados</th>
                <th className="px-4 py-3 font-medium">Rew. emit.</th>
                <th className="px-4 py-3 font-medium">Rew. recl.</th>
                <th className="px-4 py-3 font-medium">Return visits</th>
                <th className="px-4 py-3 font-medium">Recuperados</th>
              </tr>
            </thead>
            <tbody>
              {impact.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-dark">{s.name}</td>
                  <td className="px-4 py-3 text-muted">{s.recognitionEvents}</td>
                  <td className="px-4 py-3 text-muted">
                    {s.avgRating != null ? `★ ${s.avgRating.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{s.reviews}</td>
                  <td className="px-4 py-3 text-muted">{s.guestsCaptured}</td>
                  <td className="px-4 py-3 text-muted">{s.rewardsIssued}</td>
                  <td className="px-4 py-3 text-muted">{s.rewardsClaimed}</td>
                  <td className="px-4 py-3 font-medium text-dark">
                    {s.returnVisits}
                  </td>
                  <td className="px-4 py-3 font-semibold text-pink">
                    {s.recoveredGuests}
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
