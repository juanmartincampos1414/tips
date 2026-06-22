import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentRestaurant, getDashboardKpis } from "@/lib/queries";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export default async function DashboardPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const k = await getDashboardKpis(restaurant.id);

  const rates = [
    { label: "Return Visit Rate", value: pct(k.returnVisitRate), hint: "recurrentes ÷ capturados" },
    { label: "Guest Capture Rate", value: pct(k.guestCaptureRate), hint: "capturados ÷ recognition" },
    { label: "Reward Claim Rate", value: pct(k.rewardClaimRate), hint: "reclamadas ÷ emitidas" },
  ];

  const kpis = [
    { label: "Guests Captured", value: k.guestsCaptured },
    { label: "Returning Guests", value: k.returningGuests },
    { label: "Recognition Events", value: k.recognitionEvents },
    { label: "Reviews Generated", value: k.reviewsGenerated },
    { label: "Active Rewards", value: k.activeRewards },
    { label: "Claimed Rewards", value: k.claimedRewards },
    { label: "Active Staff", value: k.activeStaff },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">Resumen de {restaurant.name}</p>
        </div>
        <Link href="/staff/new" className={buttonClass()}>
          Agregar camarero
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {rates.map((r) => (
          <Card key={r.label} className="border-pink/30 bg-pink/5">
            <p className="text-sm font-medium text-dark">{r.label}</p>
            <p className="mt-2 text-4xl font-bold text-pink">{r.value}</p>
            <p className="mt-1 text-xs text-muted">{r.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-xs font-medium text-muted">{kpi.label}</p>
            <p className="mt-2 text-3xl font-bold text-dark">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted">
        North Star: Return Visit Rate. KPIs calculados en vivo. Wallet llega en la
        Fase B de Sprint 04.
      </p>
    </div>
  );
}
