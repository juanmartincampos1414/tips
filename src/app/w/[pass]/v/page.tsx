import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getMembershipForRestaurant } from "@/lib/auth";
import { resolveWalletPass } from "@/lib/tenant/resolve";
import { effectiveRewardStatus, rewardValueLabel } from "@/lib/rewards";

import { claimByPass } from "./actions";

export const dynamic = "force-dynamic";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default async function ClaimValidationPage({
  params,
}: {
  params: Promise<{ pass: string }>;
}) {
  const { pass } = await params;
  const data = await resolveWalletPass(pass);
  if (!data || !data.rewards) notFound();

  const { rewards: reward, guests: guest, restaurants: restaurant } = data;
  const status = effectiveRewardStatus(reward.status, reward.expiration_date);

  // Sprint 05A: only an authenticated member of the restaurant may validate.
  const membership = await getMembershipForRestaurant(data.restaurant_id);
  const claim = claimByPass.bind(null, pass);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-pink">
          Validación de beneficio
        </p>
        <p className="mt-1 text-center text-sm text-muted">
          {restaurant?.name}
        </p>

        <div className="mt-6 space-y-3 text-sm">
          <Row label="Cliente" value={guest?.name ?? "—"} />
          <Row
            label="Beneficio"
            value={`${rewardValueLabel(reward.reward_type, reward.value)} · ${reward.title}`}
          />
          <Row label="Vence" value={dateFmt(reward.expiration_date)} />
          <Row
            label="Estado"
            value={
              status === "active"
                ? "Activa"
                : status === "claimed"
                  ? "Ya reclamada"
                  : "Vencida"
            }
          />
        </div>

        <div className="mt-6">
          {!membership ? (
            <a
              href="/login"
              className="block rounded-xl bg-dark/5 px-4 py-3 text-center text-sm font-medium text-dark"
            >
              Iniciá sesión como personal del restaurante para validar.
            </a>
          ) : status === "active" ? (
            <form action={claim}>
              <Button type="submit" className="h-12 w-full">
                Reclamar beneficio
              </Button>
            </form>
          ) : (
            <div
              className={`rounded-xl px-4 py-3 text-center text-sm font-medium ${
                status === "claimed"
                  ? "bg-muted/10 text-muted"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {status === "claimed"
                ? "Este beneficio ya fue utilizado."
                : "Este beneficio está vencido."}
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-xs font-medium text-muted">Tips</p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-dark">{value}</span>
    </div>
  );
}
