-- =============================================================================
-- Tips · Sprint 03 (cut) — Guest Identity
-- Reference: Sprint_03_CRM_Rewards (v1.1) — Guest capture only.
--
-- Scope: guests + guest↔recognition_event association + capture metrics.
-- Out of scope (later): rewards, segments, redemptions, wallet, loyalty.
--
-- Note: restaurant_id is added (not in the raw spec schema) so the CRM is
-- per-restaurant for owner RLS and per-restaurant capture metrics.
-- =============================================================================

create table if not exists public.guests (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null references public.restaurants (id) on delete cascade,
  name               text,
  email              text,
  phone              text,
  source             text not null default 'recognition'
                       check (source in ('recognition', 'manual', 'import')),
  marketing_consent  boolean not null default false,
  last_staff_id      uuid references public.staff (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists guests_restaurant_id_idx on public.guests (restaurant_id);
create index if not exists guests_restaurant_email_idx
  on public.guests (restaurant_id, email);

create trigger guests_set_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — guests are captured server-side (service role); owners read their CRM.
-- ----------------------------------------------------------------------------
alter table public.guests enable row level security;

create policy "Anyone can create a guest"
  on public.guests for insert to anon, authenticated with check (true);

create policy "Owners read their guests"
  on public.guests for select using (
    exists (
      select 1 from public.restaurants r
      where r.id = guests.restaurant_id and r.owner_id = auth.uid()
    )
  );
