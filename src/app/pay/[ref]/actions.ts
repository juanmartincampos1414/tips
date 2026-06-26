"use server";

import { redirect } from "next/navigation";

import { handlePaymentWebhook } from "@/lib/payments/service";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const supabase = createAdminClient();
  await supabase.from("payments").update({ status: "expired" }).eq("external_reference", ref);
  redirect(`/pay/${ref}/return`);
}
