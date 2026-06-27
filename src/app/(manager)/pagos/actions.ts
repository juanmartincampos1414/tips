"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { createTipPayment, refundPayment, retryPayment } from "@/lib/payments/service";
import { tenantDb } from "@/lib/tenant/db";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Sandbox helper: create a test tip payment + jump into the checkout. */
export async function createSandboxTip(formData: FormData): Promise<void> {
  const member = await requireManager();
  const amount = Number((formData.get("amount") as string) ?? "2000") || 2000;
  const { data: staff } = (await tenantDb(member.restaurantId)
    .select("staff", "id")
    .neq("status", "archived")
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };

  const result = await createTipPayment({
    restaurantId: member.restaurantId,
    guestId: null,
    staffId: staff?.id ?? null,
    recognitionEventId: null,
    amount,
    tipSource: "manual",
    businessUnit: "restaurant",
    baseUrl: await baseUrl(),
    description: "Propina de prueba (sandbox)",
  });
  if (result.checkoutUrl) redirect(result.checkoutUrl);
  revalidatePath("/pagos");
}

export async function retryPaymentAction(formData: FormData): Promise<void> {
  const member = await requireManager();
  const id = (formData.get("payment_id") as string) ?? "";
  if (id) await retryPayment(member.restaurantId, id);
  revalidatePath("/pagos");
}

export async function refundPaymentAction(formData: FormData): Promise<void> {
  const member = await requireManager();
  const id = (formData.get("payment_id") as string) ?? "";
  if (id) await refundPayment(member.restaurantId, id);
  revalidatePath("/pagos");
}
