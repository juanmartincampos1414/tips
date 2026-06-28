import "server-only";

import { tenantDb, type TenantDb } from "@/lib/tenant/db";

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
  const db = tenantDb(restaurantId);
  const { data: conn } = (await db
    .select("connections", "id, provider, status, sandbox")
    .eq("id", connectionId)
    .maybeSingle()) as {
    data: { id: string; provider: string; status: string; sandbox: boolean } | null;
  };
  if (!conn) return { ok: false, jobId: null, rowsProcessed: 0, error: "Conexión inexistente." };

  const adapter = getAdapter(conn.provider, conn.sandbox ? "sandbox" : "production");
  if (!adapter)
    return { ok: false, jobId: null, rowsProcessed: 0, error: "Provider desconocido." };

  // Open the job.
  const started = Date.now();
  const { data: job } = await db
    .insert("sync_jobs", {
      connection_id: connectionId,
      provider: conn.provider,
      direction,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const jobId = (job as { id: string } | null)?.id ?? null;
  await emitEvent({ restaurantId, type: "SyncStarted", source: conn.provider, payload: { jobId } });

  // Validate before syncing (security requirement).
  const test = await adapter.testConnection();
  if (!test.ok) return finishFailed(db, restaurantId, conn.id, conn.provider, jobId, started, test.message);

  const result = await adapter.sync(direction);
  const duration = Date.now() - started;

  if (!result.ok)
    return finishFailed(db, restaurantId, conn.id, conn.provider, jobId, started, result.error ?? "Sync falló");

  if (jobId)
    await db
      .update("sync_jobs", {
        status: "completed",
        rows_processed: result.rowsProcessed,
        duration_ms: duration,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  await db
    .update("connections", {
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
  db: TenantDb,
  restaurantId: string,
  connectionId: string,
  provider: string,
  jobId: string | null,
  started: number,
  error: string,
): Promise<RunSyncResult> {
  if (jobId)
    await db
      .update("sync_jobs", {
        status: "failed",
        error,
        duration_ms: Date.now() - started,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  // Decrement health on failure (floor 0).
  const { data: c } = (await db
    .select("connections", "health")
    .eq("id", connectionId)
    .maybeSingle()) as { data: { health: number } | null };
  const health = Math.max(0, (c?.health ?? 100) - 25);
  await db
    .update("connections", { status: "sync_error", last_error: error, health })
    .eq("id", connectionId);
  await emitEvent({ restaurantId, type: "SyncFailed", source: provider, payload: { jobId, error } });
  return { ok: false, jobId, rowsProcessed: 0, error };
}
