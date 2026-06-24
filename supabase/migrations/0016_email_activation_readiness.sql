-- =============================================================================
-- Tips · Sprint 8A — Email Activation Readiness
--
-- Make the email layer flip-on ready: a `processing` state + retry bookkeeping
-- for consistent send lifecycle (pending → processing → sent | failed), and a
-- lookup index so the Resend webhook can resolve events by provider message id.
-- No new business logic — just the plumbing for real, traceable delivery.
-- =============================================================================

-- Extend the send lifecycle with `processing` (in-flight) + retry metadata.
alter table public.email_logs
  drop constraint if exists email_logs_status_check;
alter table public.email_logs
  add constraint email_logs_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'skipped'));

alter table public.email_logs
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

-- Webhook resolves email.delivered/opened/clicked/bounced/complained by the
-- provider message id Resend returns on send.
create index if not exists email_logs_provider_msg_idx
  on public.email_logs (provider_message_id);
