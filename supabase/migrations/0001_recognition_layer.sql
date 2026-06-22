-- =============================================================================
-- Tips · Sprint 01 — Recognition Layer
-- Reference: Sprint_01_Recognition_Layer (v1.0) + TIPS Master PRD V2.0
--
-- Scope: restaurants, staff, nfc_tags, visits.
-- Out of scope (later sprints): tips, ratings, reviews, guests, rewards, wallet.
--
-- Business rules enforced here:
--   R1 · Cada NFC pertenece a un único Staff.
--   R2 · Un Staff sólo puede tener una banda NFC activa.
--   R3 · Toda interacción genera un Visit.
--   R10 · Ningún dato histórico debe eliminarse (archive, never delete).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- restaurants
-- ----------------------------------------------------------------------------
create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  email       text,
  phone       text,
  status      text not null default 'active'
                check (status in ('active', 'inactive', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- staff — "Cada banda pertenece a una persona, nunca a una mesa."
-- ----------------------------------------------------------------------------
create table if not exists public.staff (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  photo_url      text,
  role           text,
  email          text,
  phone          text,
  status         text not null default 'active'
                   check (status in ('active', 'inactive', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists staff_restaurant_id_idx on public.staff (restaurant_id);

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- nfc_tags — R1: one tag → one staff · R2: one ACTIVE tag per staff
-- ----------------------------------------------------------------------------
create table if not exists public.nfc_tags (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff (id) on delete cascade,
  nfc_code    text not null unique,
  status      text not null default 'active'
                check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now()
);

-- R2 · A staff member can have at most one active NFC band.
create unique index if not exists nfc_tags_one_active_per_staff_idx
  on public.nfc_tags (staff_id)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- visits — R3: every interaction creates a Visit
-- ----------------------------------------------------------------------------
create table if not exists public.visits (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  staff_id       uuid not null references public.staff (id) on delete cascade,
  source         text not null default 'nfc'
                   check (source in ('nfc', 'reward_redemption', 'manual')),
  created_at     timestamptz not null default now()
);

create index if not exists visits_restaurant_id_idx on public.visits (restaurant_id);
create index if not exists visits_staff_id_idx on public.visits (staff_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Owners manage their own restaurant data; public staff profiles are readable
-- by anonymous guests (the NFC tap flow). Visits can be inserted by anyone
-- (a guest tapping a band) but only read by the owner.
-- ----------------------------------------------------------------------------
alter table public.restaurants enable row level security;
alter table public.staff       enable row level security;
alter table public.nfc_tags    enable row level security;
alter table public.visits      enable row level security;

-- restaurants: owner-scoped
create policy "Owners manage their restaurants"
  on public.restaurants for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- staff: owner of the parent restaurant manages; public can read active profiles
create policy "Owners manage their staff"
  on public.staff for all
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = staff.restaurant_id and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = staff.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "Public can read active staff profiles"
  on public.staff for select
  to anon, authenticated
  using (status = 'active');

-- nfc_tags: owner-scoped; public can read active tags to resolve a tap
create policy "Owners manage their nfc tags"
  on public.nfc_tags for all
  using (
    exists (
      select 1 from public.staff s
      join public.restaurants r on r.id = s.restaurant_id
      where s.id = nfc_tags.staff_id and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.staff s
      join public.restaurants r on r.id = s.restaurant_id
      where s.id = nfc_tags.staff_id and r.owner_id = auth.uid()
    )
  );

create policy "Public can resolve active nfc tags"
  on public.nfc_tags for select
  to anon, authenticated
  using (status = 'active');

-- visits: any guest tap can create a visit; only the owner can read them
create policy "Anyone can create a visit"
  on public.visits for insert
  to anon, authenticated
  with check (true);

create policy "Owners read their visits"
  on public.visits for select
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = visits.restaurant_id and r.owner_id = auth.uid()
    )
  );
