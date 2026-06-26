import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

const money = (n: number, c: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

const COPY: Record<string, { title: string; sub: string; tone: string }> = {
  approved: { title: "¡Pago aprobado! 🎉", sub: "Gracias por reconocer al equipo.", tone: "text-success" },
  rejected: { title: "Pago rechazado", sub: "No se pudo procesar. Podés reintentar.", tone: "text-pink" },
  expired: { title: "Checkout expirado", sub: "Abandonaste el pago. Podés reintentar.", tone: "text-amber-700" },
  cancelled: { title: "Pago cancelado", sub: "Podés reintentar cuando quieras.", tone: "text-muted" },
  pending: { title: "Esperando confirmación…", sub: "Tu pago se está procesando.", tone: "text-muted" },
  processing: { title: "Procesando…", sub: "Tu pago se está procesando.", tone: "text-muted" },
};

export default async function PaymentReturnPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("amount, currency, status, failure_reason")
    .eq("external_reference", ref)
    .maybeSingle();
  if (!payment) notFound();

  const status = payment.status as PaymentStatus;
  const c = COPY[status] ?? COPY.pending;
  const canRetry = ["rejected", "expired", "cancelled"].includes(status);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-muted">
        {money(Number(payment.amount), payment.currency)}
      </p>
      <h1 className={`mt-2 text-2xl font-bold ${c.tone}`}>{c.title}</h1>
      <p className="mt-2 text-sm text-muted">{c.sub}</p>
      {payment.failure_reason ? (
        <p className="mt-1 text-xs text-pink">Motivo: {payment.failure_reason}</p>
      ) : null}
      <p className="mt-4 inline-block self-center rounded-full bg-background px-3 py-1 text-xs font-medium text-muted">
        {PAYMENT_STATUS_LABEL[status] ?? status}
      </p>

      {canRetry ? (
        <Link
          href={`/pay/${ref}`}
          className="mt-6 rounded-xl bg-pink px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Reintentar
        </Link>
      ) : null}
    </main>
  );
}
