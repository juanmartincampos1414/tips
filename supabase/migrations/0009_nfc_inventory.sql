-- =============================================================================
-- Tips · Sprint 05B — NFC Operations
--
-- nfc_inventory is the source of truth for physical bands. The guest tap
-- resolves a band by its `uid` (status 'assigned') → assigned_staff_id → staff.
-- nfc_events gives per-band traceability (never deleted). Existing active
-- nfc_tags are migrated into the inventory as assigned bands.
-- =============================================================================

create table if not exists public.nfc_inventory (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  serial_number     text not null,
  uid               text not null unique,
  status            text not null default 'stock'
                      check (status in ('stock', 'assigned', 'lost', 'damaged', 'archived')),
  assigned_staff_id uuid references public.staff (id) on delete set null,
  assigned_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists nfc_inventory_restaurant_id_idx
  on public.nfc_inventory (restaurant_id);
create index if not exists nfc_inventory_assigned_staff_id_idx
  on public.nfc_inventory (assigned_staff_id);

create trigger nfc_inventory_set_updated_at
  before update on public.nfc_inventory
  for each row execute function public.set_updated_at();

-- Per-band lifecycle history (append-only).
create table if not exists public.nfc_events (
  id             uuid primary key default gen_random_uuid(),
  nfc_id         uuid not null references public.nfc_inventory (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  staff_id       uuid references public.staff (id) on delete set null,
  event          text not null
                   check (event in ('created', 'assigned', 'replaced', 'unassigned', 'lost', 'damaged', 'archived')),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists nfc_events_nfc_id_idx on public.nfc_events (nfc_id, created_at);
create index if not exists nfc_events_staff_id_idx on public.nfc_events (staff_id);

-- Migrate existing active bands into the inventory as assigned.
insert into public.nfc_inventory (restaurant_id, serial_number, uid, status, assigned_staff_id, assigned_at)
select s.restaurant_id, t.nfc_code, t.nfc_code, 'assigned', t.staff_id, t.created_at
from public.nfc_tags t
join public.staff s on s.id = t.staff_id
where t.status = 'active'
on conflict (uid) do nothing;

insert into public.nfc_events (nfc_id, restaurant_id, staff_id, event)
select i.id, i.restaurant_id, i.assigned_staff_id, 'assigned'
from public.nfc_inventory i
where i.status = 'assigned'
  and not exists (select 1 from public.nfc_events e where e.nfc_id = i.id);

-- RLS (owner-scoped; tap + manager run server-side via service role).
alter table public.nfc_inventory enable row level security;
alter table public.nfc_events    enable row level security;

create policy "Owners manage their nfc inventory"
  on public.nfc_inventory for all
  using (exists (select 1 from public.restaurants r where r.id = nfc_inventory.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = nfc_inventory.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their nfc events"
  on public.nfc_events for select
  using (exists (select 1 from public.restaurants r where r.id = nfc_events.restaurant_id and r.owner_id = auth.uid()));
