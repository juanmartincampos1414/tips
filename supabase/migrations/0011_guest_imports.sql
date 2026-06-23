-- =============================================================================
-- Tips · Sprint 06B — Guest Import Infrastructure
--
-- Two-phase import: upload+parse → preview (rows with detected action, no
-- writes) → confirm → apply (create/merge guests) → summary. Dedup/merge by
-- email and phone. Architecture-first: raw + mapped jsonb keep every external
-- field for future campaigns/loyalty/segmentation.
-- =============================================================================

create table if not exists public.guest_imports (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  filename       text,
  source         text,
  status         text not null default 'previewed'
                   check (status in ('previewed', 'completed', 'failed')),
  total_rows     integer not null default 0,
  created_count  integer not null default 0,
  updated_count  integer not null default 0,
  skipped_count  integer not null default 0,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists guest_imports_restaurant_id_idx
  on public.guest_imports (restaurant_id, created_at desc);

create table if not exists public.guest_import_rows (
  id               uuid primary key default gen_random_uuid(),
  import_id        uuid not null references public.guest_imports (id) on delete cascade,
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  row_number       integer not null,
  raw              jsonb,
  mapped           jsonb,
  action           text not null default 'create'
                     check (action in ('create', 'update', 'skip', 'invalid')),
  matched_guest_id uuid references public.guests (id) on delete set null,
  error            text,
  created_at       timestamptz not null default now()
);
create index if not exists guest_import_rows_import_id_idx
  on public.guest_import_rows (import_id, row_number);

create table if not exists public.import_logs (
  id             uuid primary key default gen_random_uuid(),
  import_id      uuid not null references public.guest_imports (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  level          text not null default 'info' check (level in ('info', 'warn', 'error')),
  message        text not null,
  created_at     timestamptz not null default now()
);
create index if not exists import_logs_import_id_idx
  on public.import_logs (import_id, created_at);

-- RLS (owner-scoped defense-in-depth; manager access enforced app-layer).
alter table public.guest_imports     enable row level security;
alter table public.guest_import_rows enable row level security;
alter table public.import_logs       enable row level security;

create policy "Owners manage their imports"
  on public.guest_imports for all
  using (exists (select 1 from public.restaurants r where r.id = guest_imports.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = guest_imports.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their import rows"
  on public.guest_import_rows for select
  using (exists (select 1 from public.restaurants r where r.id = guest_import_rows.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their import logs"
  on public.import_logs for select
  using (exists (select 1 from public.restaurants r where r.id = import_logs.restaurant_id and r.owner_id = auth.uid()));
