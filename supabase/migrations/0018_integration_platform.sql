-- =============================================================================
-- Tips · Sprint 9 — Hospitality Integration Platform (architecture only)
--
-- The plumbing to connect ANY POS / PMS / reservations / CRM / payments /
-- comms provider without touching the Core: a connection per provider, a sync
-- job ledger, and an internal event bus. NO real integrations, no external API
-- calls, no plaintext secrets — connections store only a credentials *reference*
-- (env var / future Secret Manager key) + non-secret metadata. Sandbox-first.
-- =============================================================================

-- connections — one row per provider a restaurant has wired up.
create table if not exists public.connections (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  provider          text not null,
  category          text not null check (category in (
                      'pos', 'pms', 'reservations', 'crm', 'payments',
                      'marketing', 'email', 'whatsapp', 'wallet', 'identity', 'analytics')),
  status            text not null default 'needs_configuration' check (status in (
                      'connected', 'disconnected', 'needs_configuration', 'sync_error', 'disabled')),
  sandbox           boolean not null default true,
  -- NEVER store secrets here: only a reference (env var / Secret Manager key id)
  -- and non-secret metadata (which fields are set, masked hints).
  credentials_ref   text,
  credentials_meta  jsonb not null default '{}'::jsonb,
  capabilities      jsonb not null default '{}'::jsonb,
  last_sync         timestamptz,
  next_sync         timestamptz,
  last_error        text,
  health            integer not null default 100 check (health between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (restaurant_id, provider)
);

create index if not exists connections_restaurant_idx
  on public.connections (restaurant_id, category, status);

create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

-- sync_jobs — every sync attempt (the observability ledger of integrations).
create table if not exists public.sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  connection_id   uuid references public.connections (id) on delete set null,
  provider        text not null,
  direction       text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  status          text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  rows_processed  integer not null default 0,
  duration_ms     integer,
  error           text,
  retry_count     integer not null default 0,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists sync_jobs_restaurant_idx
  on public.sync_jobs (restaurant_id, provider, created_at);

-- integration_events — the internal event bus log. Every relevant change emits
-- a typed event (GuestCreated, RecognitionCreated, PaymentCompleted, …). Future
-- automations / AI subscribe to this; today it's an append-only audit stream.
create table if not exists public.integration_events (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  type            text not null,
  source          text not null default 'core',
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists integration_events_restaurant_idx
  on public.integration_events (restaurant_id, type, created_at);

-- ----------------------------------------------------------------------------
-- RLS — owner-scoped (service-role app bypasses; guards direct API access).
-- ----------------------------------------------------------------------------
alter table public.connections        enable row level security;
alter table public.sync_jobs          enable row level security;
alter table public.integration_events enable row level security;

create policy "Owners manage their connections"
  on public.connections for all
  using (exists (select 1 from public.restaurants r where r.id = connections.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = connections.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their sync jobs"
  on public.sync_jobs for select
  using (exists (select 1 from public.restaurants r where r.id = sync_jobs.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their integration events"
  on public.integration_events for select
  using (exists (select 1 from public.restaurants r where r.id = integration_events.restaurant_id and r.owner_id = auth.uid()));
