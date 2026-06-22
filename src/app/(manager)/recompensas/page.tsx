import { claimReward } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getCurrentRestaurant,
  getRewardTemplates,
  getRewards,
} from "@/lib/queries";
import type { RewardStatus } from "@/lib/database.types";
import { rewardTypeLabel, rewardValueLabel } from "@/lib/rewards";

import { TemplateForm } from "./template-form";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const STATUS_BADGE: Record<RewardStatus, string> = {
  active: "bg-success/10 text-success",
  claimed: "bg-pink/10 text-pink",
  expired: "bg-background text-muted",
};
const STATUS_LABEL: Record<RewardStatus, string> = {
  active: "Activa",
  claimed: "Reclamada",
  expired: "Vencida",
};

export default async function RecompensasPage() {
  const restaurant = (await getCurrentRestaurant())!;
  const [templates, rewards] = await Promise.all([
    getRewardTemplates(restaurant.id),
    getRewards(restaurant.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-dark">
          Recompensas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Configurá tus beneficios y validá los claims de tus clientes.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Templates */}
        <div className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-dark">
            Templates configurados
          </h2>
          <div className="flex flex-col gap-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted">
                Sin templates. Si no creás uno, se emite un 10% de descuento por
                defecto.
              </p>
            ) : (
              templates.map((t) => (
                <Card key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-dark">{t.title}</p>
                    <p className="text-xs text-muted">
                      {rewardTypeLabel(t.reward_type)} ·{" "}
                      {rewardValueLabel(t.reward_type, t.value)} · vence a{" "}
                      {t.expiration_days} días
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Rewards emitidas */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-dark">
            Rewards emitidas
          </h2>
          {rewards.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-sm text-muted">
                Todavía no se emitieron recompensas. Se generan cuando un cliente
                completa el reconocimiento y deja sus datos.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Beneficio</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Vence</th>
                    <th className="px-4 py-3 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-dark">
                        {r.guests?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <span className="font-medium text-dark">
                          {rewardValueLabel(r.reward_type, r.value)}
                        </span>{" "}
                        {r.title}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {dateFmt(r.expiration_date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === "active" ? (
                          <form action={claimReward}>
                            <input type="hidden" name="reward_id" value={r.id} />
                            <SubmitButton
                              pendingLabel="…"
                              className="h-auto bg-pink/10 px-3 py-1.5 text-xs font-semibold text-pink hover:bg-pink/20"
                            >
                              Reclamar
                            </SubmitButton>
                          </form>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="mb-3 text-sm font-semibold text-dark">
          Nuevo template de beneficio
        </h2>
        <Card>
          <TemplateForm />
        </Card>
      </div>
    </div>
  );
}
