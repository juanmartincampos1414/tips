-- =============================================================================
-- Tips · Sprint 02A — Recognition Engine
-- Reference: Sprint_02_Tips_Reviews (v1.0) + TIPS Master PRD V2.1
--
-- Scope: tips, ratings, recognition_events.
-- Out of scope (Sprint 02B+): review_requests, CRM/guests, rewards, wallet.
--
-- Notes:
--   * guest_id is a nullable UUID with NO foreign key — the guests/CRM table
--     does not exist yet. Recognition in 2A is anonymous.
--   * Tips are recorded, not charged (no payment gateway in MVP); payment_status
--     defaults to 'completed' to represent an acknowledged tip.
--   * A Recognition Event always has a rating; the tip is optional (PRD caso 2).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- tips
-- ----------------------------------------------------------------------------
create table if not exists public.tips (
  id              uuid primary key default gen_random_uuid(),
  staff_id        uuid not null references public.staff (id) on delete cascade,
  guest_id        uuid,
  amount          numeric(12, 2) not null check (amount >= 0),
  currency        text not null default 'ARS',
  payment_status  text not null default 'completed'
                    check (payment_status in ('pending', 'completed', 'failed', 'refunded')),
  created_at      timestamptz not null default now()
);

create index if not exists tips_staff_id_idx on public.tips (staff_id);

-- ----------------------------------------------------------------------------
-- ratings
-- ----------------------------------------------------------------------------
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff (id) on delete cascade,
  guest_id    uuid,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists ratings_staff_id_idx on public.ratings (staff_id);

-- ----------------------------------------------------------------------------
-- recognition_events — the fundamental unit of the system
-- ----------------------------------------------------------------------------
create table if not exists public.recognition_events (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  staff_id       uuid not null references public.staff (id) on delete cascade,
  guest_id       uuid,
  tip_id         uuid references public.tips (id) on delete set null,
  rating_id      uuid references public.ratings (id) on delete set null,
  source         text not null default 'nfc'
                   check (source in ('nfc', 'qr', 'manual')),
  created_at     timestamptz not null default now()
);

create index if not exists recognition_events_restaurant_id_idx
  on public.recognition_events (restaurant_id);
create index if not exists recognition_events_staff_id_idx
  on public.recognition_events (staff_id);

-- ----------------------------------------------------------------------------
-- Row Level Security — guests (anon) can create; owners read their own.
-- The manager and the public flow operate server-side via the service role,
-- so these policies are defense-in-depth + ready for an anon-client move.
-- ----------------------------------------------------------------------------
alter table public.tips               enable row level security;
alter table public.ratings            enable row level security;
alter table public.recognition_events enable row level security;

create policy "Anyone can create a tip"
  on public.tips for insert to anon, authenticated with check (true);
create policy "Owners read their tips"
  on public.tips for select using (
    exists (
      select 1 from public.staff s
      join public.restaurants r on r.id = s.restaurant_id
      where s.id = tips.staff_id and r.owner_id = auth.uid()
    )
  );

create policy "Anyone can create a rating"
  on public.ratings for insert to anon, authenticated with check (true);
create policy "Owners read their ratings"
  on public.ratings for select using (
    exists (
      select 1 from public.staff s
      join public.restaurants r on r.id = s.restaurant_id
      where s.id = ratings.staff_id and r.owner_id = auth.uid()
    )
  );

create policy "Anyone can create a recognition event"
  on public.recognition_events for insert to anon, authenticated with check (true);
create policy "Owners read their recognition events"
  on public.recognition_events for select using (
    exists (
      select 1 from public.restaurants r
      where r.id = recognition_events.restaurant_id and r.owner_id = auth.uid()
    )
  );
