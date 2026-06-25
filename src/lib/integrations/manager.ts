import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { PROVIDERS, type ProviderDef } from "./registry";
import type { ConnectionStatus } from "./types";

// =============================================================================
// Connection Manager — the read model the Integration Hub renders. Merges the
// provider catalog (registry) with each restaurant's connection state, and
// rolls up a health view across all integrations.
// =============================================================================

export type ConnectionRow = {
  id: string;
  provider: string;
  status: ConnectionStatus;
  sandbox: boolean;
  last_sync: string | null;
  next_sync: string | null;
  last_error: string | null;
  health: number;
};

export type IntegrationCard = ProviderDef & {
  connection: ConnectionRow | null;
  status: ConnectionStatus;
};

export type IntegrationsView = {
  cards: IntegrationCard[];
  summary: {
    total: number;
    connected: number;
    errors: number;
    avgHealth: number | null;
  };
};

export async function getIntegrationsView(
  restaurantId: string,
): Promise<IntegrationsView> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("connections")
    .select("id, provider, status, sandbox, last_sync, next_sync, last_error, health")
    .eq("restaurant_id", restaurantId);
  const byProvider = new Map<string, ConnectionRow>(
    (data ?? []).map((c) => [c.provider, c as ConnectionRow]),
  );

  const cards: IntegrationCard[] = PROVIDERS.map((p) => {
    const connection = byProvider.get(p.id) ?? null;
    return {
      ...p,
      connection,
      status: (connection?.status as ConnectionStatus) ?? "needs_configuration",
    };
  });

  const live = [...byProvider.values()];
  const connected = live.filter((c) => c.status === "connected");
  const errors = live.filter((c) => c.status === "sync_error").length;
  const avgHealth = connected.length
    ? Math.round(connected.reduce((n, c) => n + c.health, 0) / connected.length)
    : null;

  return {
    cards,
    summary: { total: live.length, connected: connected.length, errors, avgHealth },
  };
}

export type SyncJobRow = {
  id: string;
  provider: string;
  direction: string;
  status: string;
  rows_processed: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
};

export async function getSyncJobs(
  restaurantId: string,
  limit = 20,
): Promise<SyncJobRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sync_jobs")
    .select("id, provider, direction, status, rows_processed, duration_ms, error, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
