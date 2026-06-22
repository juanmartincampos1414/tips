import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getCurrentRestaurant,
  getDashboardStats,
} from "@/lib/queries";

export default async function DashboardPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const stats = await getDashboardStats(restaurant.id);

  const kpis = [
    { label: "Total camareros", value: stats.totalStaff },
    { label: "Total visitas", value: stats.totalVisits },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Resumen de {restaurant.name}
          </p>
        </div>
        <Link href="/staff/new" className={buttonClass()}>
          Agregar camarero
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-sm font-medium text-muted">{kpi.label}</p>
            <p className="mt-2 text-4xl font-bold text-dark">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted">
        Sprint 01 · Recognition Layer — propinas, reseñas, CRM y rewards llegan en
        los próximos sprints.
      </p>
    </div>
  );
}
