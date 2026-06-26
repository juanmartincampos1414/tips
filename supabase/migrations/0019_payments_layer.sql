-- =============================================================================
-- Tips · Sprint 10 — Payments Layer (Mercado Pago first adapter)
--
-- Tips stop being just a logical record and become real money. Gateway-agnostic
-- (Core depends only on PaymentProvider), event-driven, idempotent. Mercado Pago
-- is the first adapter; sandbox-first. NEVER store access tokens here. From day
-- one we carry tip_source + business_unit so hotels/bars/beach clubs/spas plug in
-- with no re-migration.
-- =============================================================================

create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references public.restaurants (id) on delete cascade,
  guest_id             uuid references public.guests (id) on delete set null,
  staff_id             uuid references public.staff (id) on delete set null,
  recognition_event_id uuid references public.recognition_events (id) on delete set null,
  provider             text not null default 'mercadopago',
  provider_payment_id  text,
  external_reference   text not null unique,
  amount               numeric not null,
  currency             text not null default 'ARS',
  payment_method       text,
  status               text not null default 'pending' check (status in (
                         'pending', 'processing', 'approved', 'rejected',
                         'cancelled', 'expired', 'refunded', 'chargeback')),
  failure_reason       text,
  -- Future-proofing for multi-unit hospitality (Layer).
  tip_source           text not null default 'nfc' check (tip_source in (
                         'nfc', 'qr', 'campaign', 'manual', 'hotel', 'room_service')),
  business_unit        text not null default 'restaurant' check (business_unit in (
                         'restaurant', 'hotel', 'bar', 'beach_club', 'spa')),
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz
);

-- Idempotency: one payment per provider payment id.
create unique index if not exists payments_provider_payment_idx
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create index if not exists payments_restaurant_idx
  on public.payments (restaurant_id, status, created_at);
create index if not exists payments_staff_idx on public.payments (staff_id, status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- payment_intents — separate the intent (checkout) from the confirmed payment.
create table if not exists public.payment_intents (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references public.payments (id) on delete cascade,
  provider      text not null,
  preference_id text,
  checkout_url  text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists payment_intents_payment_idx on public.payment_intents (payment_id);

-- payment_events — the per-payment event log (never mutate state directly).
create table if not exists public.payment_events (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payment_id    uuid references public.payments (id) on delete cascade,
  type          text not null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists payment_events_payment_idx on public.payment_events (payment_id, created_at);

-- staff_settlements — what each staff member is owed from approved tips.
create table if not exists public.staff_settlements (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  staff_id          uuid not null references public.staff (id) on delete cascade,
  payment_id        uuid not null references public.payments (id) on delete cascade,
  gross_amount      numeric not null,
  net_amount        numeric not null,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'paid', 'cancelled')),
  settled_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (payment_id)
);
create index if not exists staff_settlements_staff_idx on public.staff_settlements (staff_id, settlement_status);

-- restaurant_payouts — prepared, not implemented (no payout logic yet).
create table if not exists public.restaurant_payouts (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  amount        numeric not null default 0,
  status        text not null default 'pending',
  period_start  timestamptz,
  period_end    timestamptz,
  created_at    timestamptz not null default now()
);

-- recognition_events gains a confirmation gate: a tip-bearing recognition is NOT
-- confirmed until its payment is approved. Existing rows stay confirmed.
alter table public.recognition_events
  add column if not exists confirmed boolean not null default true;

-- ----------------------------------------------------------------------------
-- RLS — owner-scoped (service-role app bypasses).
-- ----------------------------------------------------------------------------
alter table public.payments           enable row level security;
alter table public.payment_intents    enable row level security;
alter table public.payment_events     enable row level security;
alter table public.staff_settlements  enable row level security;
alter table public.restaurant_payouts enable row level security;

create policy "Owners read their payments"
  on public.payments for select
  using (exists (select 1 from public.restaurants r where r.id = payments.restaurant_id and r.owner_id = auth.uid()));
create policy "Owners read their payment events"
  on public.payment_events for select
  using (exists (select 1 from public.restaurants r where r.id = payment_events.restaurant_id and r.owner_id = auth.uid()));
create policy "Owners read their settlements"
  on public.staff_settlements for select
  using (exists (select 1 from public.restaurants r where r.id = staff_settlements.restaurant_id and r.owner_id = auth.uid()));
create policy "Owners read their payouts"
  on public.restaurant_payouts for select
  using (exists (select 1 from public.restaurants r where r.id = restaurant_payouts.restaurant_id and r.owner_id = auth.uid()));
create policy "Owners read their payment intents"
  on public.payment_intents for select
  using (exists (select 1 from public.payments p join public.restaurants r on r.id = p.restaurant_id where p.id = payment_intents.payment_id and r.owner_id = auth.uid()));
