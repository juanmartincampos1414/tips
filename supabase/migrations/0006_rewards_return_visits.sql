-- =============================================================================
-- Tips · Sprint 04 Fase A — Rewards & Return Visits
-- Reference: Sprint_03_CRM_Rewards (FR-014..018) + Sprint_04_Wallet_Dashboard
--            (FR-021/022/023/025).
--
-- Scope: reward_templates, rewards, reward_claims, return_visits + the
-- recognition_events.guest_id → guests FK. Wallet tables come in Fase B.
-- =============================================================================

-- Consistency: declare the FK that Sprint 03 left as a plain UUID.
alter table public.recognition_events
  add constraint recognition_events_guest_id_fkey
  foreign key (guest_id) references public.guests (id) on delete set null;

-- ----------------------------------------------------------------------------
-- reward_templates — per-restaurant configurable reward definitions (FR-018)
-- ----------------------------------------------------------------------------
create table if not exists public.reward_templates (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  title            text not null,
  reward_type      text not null
                     check (reward_type in ('cashback_percentage', 'cashback_fixed', 'free_item', 'special_benefit')),
  value            numeric(12, 2) not null default 0,
  expiration_days  integer not null default 30,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now()
);
create index if not exists reward_templates_restaurant_id_idx
  on public.reward_templates (restaurant_id);

-- ----------------------------------------------------------------------------
-- rewards — emitted reward instances (FR-014/016 · PRD entity 26)
-- ----------------------------------------------------------------------------
create table if not exists public.rewards (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid not null references public.guests (id) on delete cascade,
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  template_id      uuid references public.reward_templates (id) on delete set null,
  title            text not null,
  reward_type      text not null
                     check (reward_type in ('cashback_percentage', 'cashback_fixed', 'free_item', 'special_benefit')),
  value            numeric(12, 2) not null default 0,
  source           text not null default 'recognition'
                     check (source in ('recognition', 'review', 'first_visit', 'vip', 'manual')),
  status           text not null default 'active'
                     check (status in ('active', 'claimed', 'expired')),
  expiration_date  timestamptz not null,
  created_at       timestamptz not null default now()
);
create index if not exists rewards_restaurant_id_idx on public.rewards (restaurant_id);
create index if not exists rewards_guest_id_idx on public.rewards (guest_id);
create index if not exists rewards_status_idx on public.rewards (status);

-- ----------------------------------------------------------------------------
-- reward_claims — a reward claimed at the restaurant (FR-021)
-- ----------------------------------------------------------------------------
create table if not exists public.reward_claims (
  id             uuid primary key default gen_random_uuid(),
  reward_id      uuid not null references public.rewards (id) on delete cascade,
  guest_id       uuid not null references public.guests (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  claimed_at     timestamptz not null default now()
);
create index if not exists reward_claims_restaurant_id_idx
  on public.reward_claims (restaurant_id);

-- ----------------------------------------------------------------------------
-- return_visits — registered when a reward is claimed (FR-022)
-- ----------------------------------------------------------------------------
create table if not exists public.return_visits (
  id             uuid primary key default gen_random_uuid(),
  guest_id       uuid not null references public.guests (id) on delete cascade,
  reward_id      uuid references public.rewards (id) on delete set null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists return_visits_restaurant_id_idx
  on public.return_visits (restaurant_id);
create index if not exists return_visits_guest_id_idx
  on public.return_visits (guest_id);

-- ----------------------------------------------------------------------------
-- RLS — guest flow emits rewards server-side; owners manage everything.
-- ----------------------------------------------------------------------------
alter table public.reward_templates enable row level security;
alter table public.rewards          enable row level security;
alter table public.reward_claims    enable row level security;
alter table public.return_visits    enable row level security;

create policy "Owners manage their reward templates"
  on public.reward_templates for all
  using (exists (select 1 from public.restaurants r where r.id = reward_templates.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = reward_templates.restaurant_id and r.owner_id = auth.uid()));

create policy "Anyone can create a reward"
  on public.rewards for insert to anon, authenticated with check (true);
create policy "Owners manage their rewards"
  on public.rewards for all
  using (exists (select 1 from public.restaurants r where r.id = rewards.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = rewards.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners manage their reward claims"
  on public.reward_claims for all
  using (exists (select 1 from public.restaurants r where r.id = reward_claims.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = reward_claims.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners manage their return visits"
  on public.return_visits for all
  using (exists (select 1 from public.restaurants r where r.id = return_visits.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = return_visits.restaurant_id and r.owner_id = auth.uid()));
