-- =============================================================================
-- Tips · Sprint 7.6 — Campaign ROI Foundation (structure only, no real revenue)
--
-- Denormalized per-campaign value rollups so campaigns can carry their economic
-- impact. These are materialized by the attribution sync (syncCampaignConversions)
-- from campaign_conversions. estimated_revenue is a PLACEHOLDER derived from
-- tunable assumptions in src/lib/campaigns.ts — NOT real money. No POS / Mercado
-- Pago / real revenue yet.
-- =============================================================================

alter table public.campaigns
  add column if not exists estimated_revenue          numeric not null default 0,
  add column if not exists attributed_rewards         integer not null default 0,
  add column if not exists attributed_return_visits   integer not null default 0,
  add column if not exists attributed_recognitions    integer not null default 0;
