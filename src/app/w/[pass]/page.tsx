import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";

import { resolveWalletPass } from "@/lib/tenant/resolve";
import { qrSvg } from "@/lib/qr";
import { effectiveRewardStatus, rewardValueLabel } from "@/lib/rewards";

export const dynamic = "force-dynamic";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default async function WalletPassPage({
  params,
}: {
  params: Promise<{ pass: string }>;
}) {
  const { pass } = await params;
  const data = await resolveWalletPass(pass);
  if (!data || !data.rewards || !data.restaurants) notFound();

  const { rewards: reward, restaurants: restaurant, guests: guest } = data;

  // Effective status (lazy expiration on view).
  const status = effectiveRewardStatus(reward.status, reward.expiration_date);

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const validationUrl = `${proto}://${host}/w/${pass}/v`;
  const qr = await qrSvg(validationUrl);

  const statusBadge =
    status === "active"
      ? { label: "Activa", cls: "bg-success/10 text-success" }
      : status === "claimed"
        ? { label: "Ya utilizada", cls: "bg-muted/10 text-muted" }
        : { label: "Vencida", cls: "bg-warning/10 text-warning" };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-6 py-12">
      {/* Pass card */}
      <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 bg-dark px-6 py-5 text-white">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pink text-sm font-bold">
              {restaurant.name[0]?.toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-sm font-semibold">{restaurant.name}</p>
            <p className="text-xs text-white/60">Tips · Beneficio</p>
          </div>
        </div>

        <div className="px-6 py-7 text-center">
          <p className="text-6xl font-bold text-pink">
            {rewardValueLabel(reward.reward_type, reward.value)}
          </p>
          <p className="mt-1 text-lg font-semibold text-dark">{reward.title}</p>
          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusBadge.cls}`}
          >
            {statusBadge.label}
          </span>

          <div className="mt-6 flex justify-center">
            <div
              className="rounded-2xl border border-border p-3"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Mostrá este código al personal para usar tu beneficio.
          </p>

          <div className="mt-6 space-y-1 border-t border-border pt-4 text-left text-xs text-muted">
            <p>
              <span className="font-medium text-dark">Cliente:</span>{" "}
              {guest?.name ?? "—"}
            </p>
            <p>
              <span className="font-medium text-dark">Válido hasta:</span>{" "}
              {dateFmt(reward.expiration_date)}
            </p>
            <p>
              <span className="font-medium text-dark">Pass:</span> {pass.slice(0, 8)}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs font-medium text-muted">Tips</p>
    </main>
  );
}
