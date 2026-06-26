import "server-only";

import { unsafeAdminClient } from "@/lib/supabase/admin";

import { emitEvent } from "./events";
import { getAdapter } from "./registry";
import type { SyncDirection } from "./types";

// =============================================================================
// Synchronization Engine — runs a provider sync through its Adapter, recording a
// sync_job (the observability ledger) and emitting bus events. Security: it
// validates the connection (status + credentials + connectivity, simulated in
// sandbox) BEFORE syncing. Never throws — failures land as a failed job + a
// sync_error connection state with decremented health.
// =============================================================================

export type RunSyncResult = {
  ok: boolean;
  jobId: string | null;
  rowsProcessed: number;
  error?: string;
};

export async function runSync(
  restaurantId: string,
  connectionId: string,
  direction: SyncDirection = "inbound",
): Promise<RunSyncResult> {
  const supabase = unsafeAdminClient();
  const { data: conn } = await supabase
    .from("connections")
    .select("id, provider, status, sandbox")
    .eq("id", connectionId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!conn) return { ok: false, jobId: null, rowsProcessed: 0, error: "Conexión inexistente." };

  const adapter = getAdapter(conn.provider, conn.sandbox ? "sandbox" : "production");
  if (!adapter)
    return { ok: false, jobId: null, rowsProcessed: 0, error: "Provider desconocido." };

  // Open the job.
  const started = Date.now();
  const { data: job } = await supabase
    .from("sync_jobs")
    .insert({
      restaurant_id: restaurantId,
      connection_id: connectionId,
      provider: conn.provider,
      direction,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const jobId = job?.id ?? null;
  await emitEvent({ restaurantId, type: "SyncStarted", source: conn.provider, payload: { jobId } });

  // Validate before syncing (security requirement).
  const test = await adapter.testConnection();
  if (!test.ok) return finishFailed(supabase, restaurantId, conn.id, conn.provider, jobId, started, test.message);

  const result = await adapter.sync(direction);
  const duration = Date.now() - started;

  if (!result.ok)
    return finishFailed(supabase, restaurantId, conn.id, conn.provider, jobId, started, result.error ?? "Sync falló");

  if (jobId)
    await supabase
      .from("sync_jobs")
      .update({
        status: "completed",
        rows_processed: result.rowsProcessed,
        duration_ms: duration,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  await supabase
    .from("connections")
    .update({
      status: "connected",
      last_sync: new Date().toISOString(),
      next_sync: new Date(Date.now() + 24 * 3600_000).toISOString(),
      last_error: null,
      health: 100,
    })
    .eq("id", conn.id);
  await emitEvent({
    restaurantId,
    type: "SyncCompleted",
    source: conn.provider,
    payload: { jobId, rows: result.rowsProcessed, durationMs: duration },
  });

  return { ok: true, jobId, rowsProcessed: result.rowsProcessed };
}

async function finishFailed(
  supabase: ReturnType<typeof unsafeAdminClient>,
  restaurantId: string,
  connectionId: string,
  provider: string,
  jobId: string | null,
  started: number,
  error: string,
): Promise<RunSyncResult> {
  if (jobId)
    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        error,
        duration_ms: Date.now() - started,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  // Decrement health on failure (floor 0).
  const { data: c } = await supabase
    .from("connections")
    .select("health")
    .eq("id", connectionId)
    .maybeSingle();
  const health = Math.max(0, (c?.health ?? 100) - 25);
  await supabase
    .from("connections")
    .update({ status: "sync_error", last_error: error, health })
    .eq("id", connectionId);
  await emitEvent({ restaurantId, type: "SyncFailed", source: provider, payload: { jobId, error } });
  return { ok: false, jobId, rowsProcessed: 0, error };
}
