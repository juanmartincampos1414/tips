import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getCurrentRestaurant } from "@/lib/queries";

import { RestaurantSetupForm } from "./restaurant-setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Sprint 01: single restaurant. If one exists, jump straight to the manager.
  const restaurant = await getCurrentRestaurant();
  if (restaurant) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold text-pink">Tips</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-dark">
          Creá tu restaurante
        </h1>
        <p className="mt-2 text-sm text-muted">
          El primer paso para empezar a reconocer a tu equipo.
        </p>
      </div>

      <Card>
        <RestaurantSetupForm />
      </Card>
    </main>
  );
}
