import { notFound } from "next/navigation";

import { resolvePaymentByToken } from "@/lib/tenant/resolve";

import { approveSandbox, cancelSandbox, rejectSandbox } from "./actions";

export const dynamic = "force-dynamic";

const money = (n: number, c: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export default async function SandboxCheckoutPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const payment = await resolvePaymentByToken({ externalReference: ref });
  if (!payment) notFound();

  const settled = ["approved", "rejected", "expired", "cancelled"].includes(payment.status);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Checkout sandbox · Mercado Pago
        </p>
        <p className="mt-4 text-4xl font-bold text-dark">
          {money(Number(payment.amount), payment.currency)}
        </p>
        <p className="mt-1 text-sm text-muted">Propina al equipo</p>

        {settled ? (
          <p className="mt-6 rounded-xl bg-background px-4 py-3 text-sm font-medium text-dark">
            Estado: {payment.status}
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <form action={approveSandbox}>
              <input type="hidden" name="ref" value={ref} />
              <button className="w-full rounded-xl bg-pink py-3 text-sm font-semibold text-white hover:opacity-90">
                Aprobar pago
              </button>
            </form>
            <form action={rejectSandbox}>
              <input type="hidden" name="ref" value={ref} />
              <button className="w-full rounded-xl border border-border py-3 text-sm font-medium text-dark hover:bg-background">
                Rechazar pago
              </button>
            </form>
            <form action={cancelSandbox}>
              <input type="hidden" name="ref" value={ref} />
              <button className="w-full py-2 text-xs font-medium text-muted hover:text-dark">
                Cancelar / abandonar
              </button>
            </form>
          </div>
        )}

        <p className="mt-6 text-[11px] text-muted">
          Modo sandbox: ningún pago real. La confirmación llega por webhook.
        </p>
      </div>
    </main>
  );
}
