-- =============================================================================
-- Tips · Sprint 06A — Hospitality CRM Foundation: Guest 360
--
-- Architecture-first: extend the guest model + internal notes/tags. Segments
-- and score are computed live (no stored table) with simple rules now,
-- persistable later. metadata jsonb keeps room for imported/external fields and
-- future campaign/loyalty/AI layers without schema churn.
-- =============================================================================

alter table public.guests
  add column if not exists birth_date date,
  add column if not exists metadata jsonb;

-- Internal notes (visible to managers).
create table if not exists public.guest_notes (
  id             uuid primary key default gen_random_uuid(),
  guest_id       uuid not null references public.guests (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  body           text not null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists guest_notes_guest_id_idx
  on public.guest_notes (guest_id, created_at desc);

-- Manual tags.
create table if not exists public.guest_tags (
  id             uuid primary key default gen_random_uuid(),
  guest_id       uuid not null references public.guests (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  tag            text not null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (guest_id, tag)
);
create index if not exists guest_tags_guest_id_idx on public.guest_tags (guest_id);
create index if not exists guest_tags_restaurant_tag_idx
  on public.guest_tags (restaurant_id, tag);

-- RLS (owner-scoped defense-in-depth; manager access enforced app-layer).
alter table public.guest_notes enable row level security;
alter table public.guest_tags  enable row level security;

create policy "Owners manage guest notes"
  on public.guest_notes for all
  using (exists (select 1 from public.restaurants r where r.id = guest_notes.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = guest_notes.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners manage guest tags"
  on public.guest_tags for all
  using (exists (select 1 from public.restaurants r where r.id = guest_tags.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = guest_tags.restaurant_id and r.owner_id = auth.uid()));
