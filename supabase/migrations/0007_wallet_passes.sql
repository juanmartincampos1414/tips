-- =============================================================================
-- Tips · Sprint 04 Fase B — Wallet Layer
-- Reference: Sprint_04_Wallet_Dashboard (FR-019/020/024) + PRD entity 27.
--
-- A wallet pass per emitted reward. MVP provider is 'web' (mobile-first pass
-- page + dynamic QR); 'apple'/'google' native emission plugs in later via
-- credentials without schema changes. Out of scope: loyalty, AI, POS.
-- =============================================================================

create table if not exists public.wallet_passes (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid not null references public.guests (id) on delete cascade,
  reward_id        uuid not null references public.rewards (id) on delete cascade,
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  wallet_provider  text not null default 'web'
                     check (wallet_provider in ('web', 'apple', 'google')),
  wallet_pass_url  text,
  pass_identifier  text not null unique,
  qr_code          text,
  status           text not null default 'active'
                     check (status in ('created', 'active', 'redeemed', 'expired')),
  created_at       timestamptz not null default now()
);

create index if not exists wallet_passes_restaurant_id_idx
  on public.wallet_passes (restaurant_id);
create index if not exists wallet_passes_reward_id_idx
  on public.wallet_passes (reward_id);

-- RLS — created server-side; pass pages resolve via the service role; owners read.
alter table public.wallet_passes enable row level security;

create policy "Anyone can create a wallet pass"
  on public.wallet_passes for insert to anon, authenticated with check (true);

create policy "Owners read their wallet passes"
  on public.wallet_passes for select using (
    exists (
      select 1 from public.restaurants r
      where r.id = wallet_passes.restaurant_id and r.owner_id = auth.uid()
    )
  );
