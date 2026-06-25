import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getCurrentRestaurant,
  getDashboardKpis,
  getNfcKpis,
} from "@/lib/queries";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export default async function DashboardPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const [k, nfc] = await Promise.all([
    getDashboardKpis(restaurant.id),
    getNfcKpis(restaurant.id),
  ]);

  // Onboarding: guide a brand-new restaurant until its first recognition lands.
  const steps = [
    { label: "Agregá tu equipo", done: k.activeStaff > 0, href: "/staff/new" },
    { label: "Asigná bandas NFC", done: nfc.assigned > 0, href: "/nfc" },
    { label: "Recibí el primer reconocimiento", done: k.recognitionEvents > 0, href: "/staff" },
    { label: "Capturá tu primer cliente", done: k.guestsCaptured > 0, href: "/clientes" },
  ];
  const showOnboarding = k.recognitionEvents === 0;

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

      {showOnboarding ? (
        <Card className="mb-6 border-pink/30 bg-pink/5">
          <p className="text-sm font-semibold text-dark">Primeros pasos</p>
          <p className="mt-0.5 text-xs text-muted">
            Configurá tu restaurante para empezar a reconocer al equipo y capturar
            clientes.
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={s.done ? "text-success" : "text-muted"}>
                  {s.done ? "✓" : `${i + 1}.`}
                </span>
                {s.done ? (
                  <span className="text-muted line-through">{s.label}</span>
                ) : (
                  <Link href={s.href} className="font-medium text-dark hover:text-pink">
                    {s.label} →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

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
