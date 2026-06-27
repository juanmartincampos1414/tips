"use server";

import { redirect } from "next/navigation";

import { handlePaymentWebhook } from "@/lib/payments/service";
import { tenantDb } from "@/lib/tenant/db";
import { resolvePaymentByToken } from "@/lib/tenant/resolve";

// Sandbox checkout simulator — each button fires a simulated Mercado Pago
// webhook (the only path that confirms money), exactly like the real provider.
async function simulate(ref: string, status: string, method: string) {
  await handlePaymentWebhook({
    type: "payment",
    data: { id: `sandbox_${ref}`, status, external_reference: ref, method },
  });
}

export async function approveSandbox(formData: FormData): Promise<void> {
  const ref = (formData.get("ref") as string) ?? "";
  await simulate(ref, "approved", "sandbox_card");
  redirect(`/pay/${ref}/return`);
}

export async function rejectSandbox(formData: FormData): Promise<void> {
  const ref = (formData.get("ref") as string) ?? "";
  await simulate(ref, "rejected", "sandbox_card");
  redirect(`/pay/${ref}/return`);
}

export async function cancelSandbox(formData: FormData): Promise<void> {
  const ref = (formData.get("ref") as string) ?? "";
  // Abandonment → expired (recognition stays pending, retry allowed).
  const payment = await resolvePaymentByToken({ externalReference: ref });
  if (payment)
    await tenantDb(payment.restaurant_id).update("payments", { status: "expired" }).eq("id", payment.id);
  redirect(`/pay/${ref}/return`);
}
