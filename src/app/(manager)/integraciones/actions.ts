"use server";

import { revalidatePath } from "next/cache";

import { logAudit, requireOwner } from "@/lib/auth";
import { emitEvent } from "@/lib/integrations/events";
import { getAdapter, getProvider } from "@/lib/integrations/registry";
import { runSync } from "@/lib/integrations/sync";
import { tenantDb } from "@/lib/tenant/db";
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

  await tenantDb(owner.restaurantId).upsert(
    "connections",
    {
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
  await tenantDb(owner.restaurantId)
    .update("connections", { status: "disconnected" })
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
  const db = tenantDb(owner.restaurantId);
  const { data: c } = (await db
    .select("connections", "sandbox")
    .eq("provider", provider)
    .maybeSingle()) as { data: { sandbox: boolean } | null };
  if (!c) return;
  await db
    .update("connections", { sandbox: !c.sandbox })
    .eq("provider", provider);
  revalidatePath("/integraciones");
}

/** Test the connection through its adapter (sandbox simulates). */
export async function testConnectionAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const provider = str(formData, "provider");
  const db = tenantDb(owner.restaurantId);
  const { data: c } = (await db
    .select("connections", "sandbox")
    .eq("provider", provider)
    .maybeSingle()) as { data: { sandbox: boolean } | null };
  const adapter = getAdapter(provider, c?.sandbox === false ? "production" : "sandbox");
  if (!adapter) return;
  const result = await adapter.testConnection();
  await db
    .update("connections", {
      last_error: result.ok ? null : result.message,
      status: result.ok ? "connected" : "sync_error",
    })
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
