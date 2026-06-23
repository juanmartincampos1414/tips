-- =============================================================================
-- Tips · Sprint 06D-B — Email Infrastructure (infra only, no campaigns)
--
-- Tables + settings to send emails safely, traceably and provider-agnostically.
-- No campaigns / automations / journeys / scheduling yet — just the plumbing:
-- templates, a per-send log, and a per-event log (provider webhooks later).
-- =============================================================================

-- Per-restaurant sender identity + master switch.
alter table public.restaurant_settings
  add column if not exists sender_name     text,
  add column if not exists sender_email    text,
  add column if not exists reply_to_email  text,
  add column if not exists email_enabled   boolean not null default false;

-- ----------------------------------------------------------------------------
-- email_templates — reusable subject/body, lifecycle draft → active → archived
-- ----------------------------------------------------------------------------
create table if not exists public.email_templates (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  subject        text not null,
  body           text not null,
  status         text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists email_templates_restaurant_idx
  on public.email_templates (restaurant_id, status);

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- email_logs — one row per attempted send (the audit trail of comms)
-- ----------------------------------------------------------------------------
create table if not exists public.email_logs (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references public.restaurants (id) on delete cascade,
  guest_id             uuid references public.guests (id) on delete set null,
  template_id          uuid references public.email_templates (id) on delete set null,
  recipient_email      text not null,
  subject              text not null,
  status               text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id  text,
  error_message        text,
  sent_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists email_logs_restaurant_idx
  on public.email_logs (restaurant_id, created_at);
create index if not exists email_logs_guest_idx
  on public.email_logs (guest_id);

-- ----------------------------------------------------------------------------
-- email_events — provider lifecycle events for a sent email (webhooks later)
-- ----------------------------------------------------------------------------
create table if not exists public.email_events (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  guest_id       uuid references public.guests (id) on delete set null,
  email_log_id   uuid not null references public.email_logs (id) on delete cascade,
  event_type     text not null check (event_type in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists email_events_log_idx
  on public.email_events (email_log_id, created_at);

-- ----------------------------------------------------------------------------
-- RLS — owner-scoped (mirrors restaurant_settings / guests). Service role (the
-- app's admin client) bypasses RLS, so these guard direct API access only.
-- ----------------------------------------------------------------------------
alter table public.email_templates enable row level security;
alter table public.email_logs      enable row level security;
alter table public.email_events    enable row level security;

create policy "Owners manage their email templates"
  on public.email_templates for all
  using (exists (select 1 from public.restaurants r where r.id = email_templates.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = email_templates.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their email logs"
  on public.email_logs for select
  using (exists (select 1 from public.restaurants r where r.id = email_logs.restaurant_id and r.owner_id = auth.uid()));

create policy "Owners read their email events"
  on public.email_events for select
  using (exists (select 1 from public.restaurants r where r.id = email_events.restaurant_id and r.owner_id = auth.uid()));
