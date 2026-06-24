import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  isReachable,
  resolveAudience,
  SEGMENT_OPTIONS,
} from "@/lib/campaigns";
import { getCrmData, getCurrentRestaurant, getEmailTemplates } from "@/lib/queries";

import { CampaignBuilder } from "./builder";

export const dynamic = "force-dynamic";

export default async function NuevaCampanaPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const [{ guests }, templates] = await Promise.all([
    getCrmData(restaurant.id),
    getEmailTemplates(restaurant.id),
  ]);

  // Pre-compute reachable counts per segment + channel for the live projection.
  const counts: Record<string, { email: number; whatsapp: number; total: number }> = {};
  for (const s of SEGMENT_OPTIONS) {
    const members = resolveAudience(guests, s.key);
    counts[s.key] = {
      total: members.length,
      email: members.filter((g) => isReachable(g, "email")).length,
      whatsapp: members.filter((g) => isReachable(g, "whatsapp")).length,
    };
  }

  const activeTemplates = templates
    .filter((t) => t.status !== "archived")
    .map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/campanas" className="text-sm font-medium text-muted hover:text-dark">
        ← Volver a campañas
      </Link>
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Nueva campaña</h1>
        <p className="mt-1 text-sm text-muted">
          Elegí segmento, canal y plantilla. Vas a poder revisar y enviar en el
          siguiente paso.
        </p>
      </header>

      <Card>
        <CampaignBuilder counts={counts} templates={activeTemplates} />
      </Card>
    </div>
  );
}
