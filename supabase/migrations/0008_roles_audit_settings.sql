-- =============================================================================
-- Tips · Sprint 05A — Production Hardening (roles, audit, settings)
--
-- Role enforcement is application-layer (server actions/pages check the
-- logged-in user's membership + role; the service role executes). These RLS
-- policies are defense-in-depth. Multi-restaurant: a user's restaurant is
-- resolved from restaurant_members, not "the first restaurant".
-- =============================================================================

-- ----------------------------------------------------------------------------
-- restaurant_members — who can access a restaurant, and with what role
-- ----------------------------------------------------------------------------
create table if not exists public.restaurant_members (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           text not null check (role in ('owner', 'manager', 'staff')),
  staff_id       uuid references public.staff (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index if not exists restaurant_members_user_id_idx
  on public.restaurant_members (user_id);
create index if not exists restaurant_members_restaurant_id_idx
  on public.restaurant_members (restaurant_id);

-- Backfill: every existing restaurant owner becomes an 'owner' member.
insert into public.restaurant_members (restaurant_id, user_id, role)
select id, owner_id, 'owner' from public.restaurants
where owner_id is not null
on conflict (restaurant_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- audit_logs — record of sensitive actions
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid references public.restaurants (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  action         text not null,
  entity_type    text,
  entity_id      uuid,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists audit_logs_restaurant_id_idx
  on public.audit_logs (restaurant_id, created_at desc);

-- ----------------------------------------------------------------------------
-- restaurant_settings — per-restaurant config (Google reviews now; more in 5D)
-- ----------------------------------------------------------------------------
create table if not exists public.restaurant_settings (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null unique references public.restaurants (id) on delete cascade,
  google_place_id   text,
  google_review_url text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger restaurant_settings_set_updated_at
  before update on public.restaurant_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — owner-scoped (via restaurants.owner_id, no recursion); members read self
-- ----------------------------------------------------------------------------
alter table public.restaurant_members  enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.restaurant_settings enable row level security;

create policy "Users read their own memberships"
  on public.restaurant_members for select using (user_id = auth.uid());
create policy "Owners manage restaurant members"
  on public.restaurant_members for all
  using (exists (select 1 from public.restaurants r where r.id = restaurant_members.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_members.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their audit logs"
  on public.audit_logs for select
  using (exists (select 1 from public.restaurants r where r.id = audit_logs.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners manage their settings"
  on public.restaurant_settings for all
  using (exists (select 1 from public.restaurants r where r.id = restaurant_settings.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_settings.restaurant_id and r.owner_id = auth.uid()));
