-- =============================================================================
-- Tips · Sprint 7.5 — Campaign Builder Foundation (measurement, not automation)
--
-- The intelligence layer: every communication becomes a measurable campaign,
-- tied to the audience it targeted (frozen), the recipients it reached, and the
-- conversions that followed within an attribution window. Builds on 06D email
-- infra; WhatsApp is a prepared channel (no live provider yet). NO automations,
-- triggers, journeys or scheduling — manual send + attribution only.
-- =============================================================================

-- campaigns — one manual send of a template to a segment over a channel.
create table if not exists public.campaigns (
  id                       uuid primary key default gen_random_uuid(),
  restaurant_id            uuid not null references public.restaurants (id) on delete cascade,
  name                     text not null,
  description              text,
  channel                  text not null default 'email' check (channel in ('email', 'whatsapp')),
  segment                  text not null,
  template_id              uuid references public.email_templates (id) on delete set null,
  status                   text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'completed', 'archived')),
  attribution_window_days  integer not null default 30,
  audience_count           integer not null default 0,
  created_by               uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  sent_at                  timestamptz
);

create index if not exists campaigns_restaurant_idx
  on public.campaigns (restaurant_id, status, created_at);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- campaign_audiences — frozen snapshot of exactly who was targeted + their
-- segment at send time (survives later segment changes).
create table if not exists public.campaign_audiences (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns (id) on delete cascade,
  guest_id          uuid not null references public.guests (id) on delete cascade,
  segment_snapshot  text,
  created_at        timestamptz not null default now(),
  unique (campaign_id, guest_id)
);

create index if not exists campaign_audiences_campaign_idx
  on public.campaign_audiences (campaign_id);

-- campaign_recipients — per-guest delivery state for this campaign. Links to the
-- underlying email_log so provider events can flow back later.
create table if not exists public.campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  guest_id      uuid not null references public.guests (id) on delete cascade,
  channel       text not null default 'email' check (channel in ('email', 'whatsapp')),
  status        text not null default 'pending' check (status in ('pending', 'delivered', 'opened', 'clicked', 'failed', 'skipped')),
  email_log_id  uuid references public.email_logs (id) on delete set null,
  reason        text,
  delivered_at  timestamptz,
  opened_at     timestamptz,
  clicked_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (campaign_id, guest_id)
);

create index if not exists campaign_recipients_campaign_idx
  on public.campaign_recipients (campaign_id, status);

-- campaign_conversions — attributed events (reward claim / return visit / review
-- / recognition) for a targeted guest inside the attribution window. Idempotent
-- on (campaign, guest, type, source event) so the sync pass can re-run safely.
create table if not exists public.campaign_conversions (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  campaign_id      uuid not null references public.campaigns (id) on delete cascade,
  guest_id         uuid not null references public.guests (id) on delete cascade,
  conversion_type  text not null check (conversion_type in ('reward_claim', 'return_visit', 'review', 'recognition')),
  conversion_date  timestamptz not null,
  source_event_id  uuid,
  created_at       timestamptz not null default now(),
  unique (campaign_id, guest_id, conversion_type, source_event_id)
);

create index if not exists campaign_conversions_campaign_idx
  on public.campaign_conversions (campaign_id, conversion_type);

-- Last-touch attribution pointer on the guest.
alter table public.guests
  add column if not exists last_campaign_id      uuid references public.campaigns (id) on delete set null,
  add column if not exists last_campaign_sent_at timestamptz;

-- ----------------------------------------------------------------------------
-- RLS — owner-scoped (service role / admin client bypasses; guards direct API).
-- ----------------------------------------------------------------------------
alter table public.campaigns             enable row level security;
alter table public.campaign_audiences    enable row level security;
alter table public.campaign_recipients   enable row level security;
alter table public.campaign_conversions  enable row level security;

create policy "Owners manage their campaigns"
  on public.campaigns for all
  using (exists (select 1 from public.restaurants r where r.id = campaigns.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = campaigns.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their campaign audiences"
  on public.campaign_audiences for select
  using (exists (select 1 from public.campaigns c join public.restaurants r on r.id = c.restaurant_id where c.id = campaign_audiences.campaign_id and r.owner_id = auth.uid()));

create policy "Owners read their campaign recipients"
  on public.campaign_recipients for select
  using (exists (select 1 from public.campaigns c join public.restaurants r on r.id = c.restaurant_id where c.id = campaign_recipients.campaign_id and r.owner_id = auth.uid()));

create policy "Owners read their campaign conversions"
  on public.campaign_conversions for select
  using (exists (select 1 from public.restaurants r where r.id = campaign_conversions.restaurant_id and r.owner_id = auth.uid()));
