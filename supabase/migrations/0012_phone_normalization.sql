-- =============================================================================
-- Tips · Sprint 06D-A — Phone Normalization & Contact Channels
--
-- Store phones omnichannel-ready: keep the original input in `phone` (raw),
-- add `phone_normalized` (E.164, e.g. +541155551234) + `country_code` (ISO2).
-- Normalization runs in the app (libphonenumber-js); has_email/has_phone/
-- has_whatsapp/preferred_channel are computed from these. Ready for WhatsApp /
-- SMS / voice / AI agents later.
-- =============================================================================

alter table public.guests
  add column if not exists phone_normalized text,
  add column if not exists country_code text;

create index if not exists guests_phone_normalized_idx
  on public.guests (restaurant_id, phone_normalized);
