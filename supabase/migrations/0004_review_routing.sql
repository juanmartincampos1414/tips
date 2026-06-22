-- =============================================================================
-- Tips · Sprint 02B — Review Routing
-- Reference: Sprint_02_Tips_Reviews (FR-009) + TIPS Master PRD V2.1
--
-- One review_request per recognition event. Routed by rating:
--   rating >= 4 → public_review   (CTA to Google)
--   rating <= 3 → private_feedback (textarea)
-- status: pending → completed (guest acted) | ignored (guest dismissed).
-- Enables review conversion measurement. Out of scope: CRM, rewards, wallet.
-- =============================================================================

create table if not exists public.review_requests (
  id                    uuid primary key default gen_random_uuid(),
  recognition_event_id  uuid not null references public.recognition_events (id) on delete cascade,
  restaurant_id         uuid not null references public.restaurants (id) on delete cascade,
  staff_id              uuid not null references public.staff (id) on delete cascade,
  route                 text not null check (route in ('public_review', 'private_feedback')),
  status                text not null default 'pending'
                          check (status in ('pending', 'completed', 'ignored')),
  feedback              text,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists review_requests_restaurant_id_idx
  on public.review_requests (restaurant_id);
create index if not exists review_requests_staff_id_idx
  on public.review_requests (staff_id);
create index if not exists review_requests_recognition_event_id_idx
  on public.review_requests (recognition_event_id);

-- RLS — guests (anon) create via the server (service role); owners read their own.
alter table public.review_requests enable row level security;

create policy "Anyone can create a review request"
  on public.review_requests for insert to anon, authenticated with check (true);

create policy "Owners read their review requests"
  on public.review_requests for select using (
    exists (
      select 1 from public.restaurants r
      where r.id = review_requests.restaurant_id and r.owner_id = auth.uid()
    )
  );
