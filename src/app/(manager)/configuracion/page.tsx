import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getCurrentMembership } from "@/lib/auth";
import { getCurrentRestaurant, getSettings } from "@/lib/queries";

import { SettingsForm } from "./settings-form";

export default async function ConfiguracionPage() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") redirect("/dashboard");

  const restaurant = (await getCurrentRestaurant())!;
  const settings = await getSettings(restaurant.id);

  return (
    <div className="mx-auto w-full max-w-lg">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted">Ajustes de {restaurant.name}.</p>
      </header>

      <h2 className="mb-3 text-sm font-semibold text-dark">Reseñas de Google</h2>
      <Card>
        <SettingsForm
          placeId={settings?.google_place_id ?? ""}
          reviewUrl={settings?.google_review_url ?? ""}
        />
      </Card>
    </div>
  );
}
