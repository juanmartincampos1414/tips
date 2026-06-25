"use server";

import { revalidatePath } from "next/cache";

import { logAudit, requireOwner } from "@/lib/auth";
import { emitEvent } from "@/lib/integrations/events";
import { getAdapter, getProvider } from "@/lib/integrations/registry";
import { runSync } from "@/lib/integrations/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type IntegrationActionState = { error?: string; ok?: string };

function str(fd: FormData, k: string) {
  return ((fd.get(k) as string | null) ?? "").trim();
}

/** Wire up a provider (sandbox). Real credentials are never entered here. */
export async function connectProvider(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const provider = str(formData, "provider");
  const def = getProvider(provider);
  if (!def) return;

  const supabase = createAdminClient();
  await supabase.from("connections").upsert(
    {
      restaurant_id: owner.restaurantId,
      provider,
      category: def.category,
      status: "connected",
      sandbox: true,
      credentials_ref: null,
      credentials_meta: { mode: "sandbox" } as Json,
      capabilities: def.capabilities as unknown as Json,
      health: 100,
    },
    { onConflict: "restaurant_id,provider" },
  );

  await emitEvent({
    restaurantId: owner.restaurantId,
    type: "ConnectionConnected",
    source: provider,
    payload: { sandbox: true },
  });
  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.userId,
    action: "connection.connected",
    entityType: "connection",
    metadata: { provider, sandbox: true },
  });

  revalidatePath("/integraciones");
}

export async function disconnectProvider(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const provider = str(formData, "provider");
  const supabase = createAdminClient();
  await supabase
    .from("connections")
    .update({ status: "disconnected" })
    .eq("restaurant_id", owner.restaurantId)
    .eq("provider", provider);

  await emitEvent({
    restaurantId: owner.restaurantId,
    type: "ConnectionDisconnected",
    source: provider,
  });
  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.userId,
    action: "connection.disconnected",
    entityType: "connection",
    metadata: { provider },
  });

  revalidatePath("/integraciones");
}

export async function toggleSandbox(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const provider = str(formData, "provider");
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("connections")
    .select("sandbox")
    .eq("restaurant_id", owner.restaurantId)
    .eq("provider", provider)
    .maybeSingle();
  if (!c) return;
  await supabase
    .from("connections")
    .update({ sandbox: !c.sandbox })
    .eq("restaurant_id", owner.restaurantId)
    .eq("provider", provider);
  revalidatePath("/integraciones");
}

/** Test the connection through its adapter (sandbox simulates). */
export async function testConnectionAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const provider = str(formData, "provider");
  const supabase = createAdminClient();
  const { data: c } = await supabase
    .from("connections")
    .select("sandbox")
    .eq("restaurant_id", owner.restaurantId)
    .eq("provider", provider)
    .maybeSingle();
  const adapter = getAdapter(provider, c?.sandbox === false ? "production" : "sandbox");
  if (!adapter) return;
  const result = await adapter.testConnection();
  await supabase
    .from("connections")
    .update({
      last_error: result.ok ? null : result.message,
      status: result.ok ? "connected" : "sync_error",
    })
    .eq("restaurant_id", owner.restaurantId)
    .eq("provider", provider);
  revalidatePath("/integraciones");
}

/** Run a sync through the Sync Engine. */
export async function syncNowAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const connectionId = str(formData, "connection_id");
  if (!connectionId) return;
  await runSync(owner.restaurantId, connectionId);
  revalidatePath("/integraciones");
}
