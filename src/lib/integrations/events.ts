import "server-only";

import { unsafeAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

import type { IntegrationEventType } from "./types";

// =============================================================================
// Internal Event Bus — modules never talk to each other directly. Every relevant
// change emits a typed event here; it's persisted to integration_events (the bus
// log future automations/AI will subscribe to) and mirrored into audit_logs for
// observability. Today there are no live subscribers — the contract is what
// matters, so wiring automations later means only adding a subscriber.
// =============================================================================

export async function emitEvent(params: {
  restaurantId: string;
  type: IntegrationEventType;
  source?: string; // 'core' (default) or a provider id
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = unsafeAdminClient();
  const source = params.source ?? "core";
  await supabase.from("integration_events").insert({
    restaurant_id: params.restaurantId,
    type: params.type,
    source,
    payload: (params.payload ?? {}) as Json,
  });
  // Mirror to the audit trail (observability).
  await supabase.from("audit_logs").insert({
    restaurant_id: params.restaurantId,
    user_id: null,
    action: `event.${params.type}`,
    entity_type: "integration_event",
    entity_id: null,
    metadata: { source, ...(params.payload ?? {}) } as Json,
  });
}

export type RecentEvent = {
  id: string;
  type: string;
  source: string;
  created_at: string;
};

export async function getRecentEvents(
  restaurantId: string,
  limit = 30,
): Promise<RecentEvent[]> {
  const supabase = unsafeAdminClient();
  const { data } = await supabase
    .from("integration_events")
    .select("id, type, source, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
