-- =============================================================================
-- Tips · Sprint 8B — Security hardening: drop vestigial anon policies
--
-- The whole app accesses data through the server-only service-role client
-- (lib/supabase/admin.ts), which bypasses RLS. The browser anon client
-- (lib/supabase/client.ts) is NOT used anywhere, and the SSR client is used only
-- for auth (getUser/sign-in/out) — never for table reads. So every `to anon`
-- policy below is dead weight AND attack surface: with the public anon key
-- anyone could POST to PostgREST and inject rows (fake guests/tips/ratings/
-- recognition events inflating metrics, fake rewards) or enumerate every
-- restaurant's staff/NFC. Dropping them makes RLS deny-by-default for anon while
-- the service-role app keeps working unchanged.
-- =============================================================================

-- Over-permissive INSERTs (with check (true)) — close the injection surface.
drop policy if exists "Anyone can create a tip"               on public.tips;
drop policy if exists "Anyone can create a rating"            on public.ratings;
drop policy if exists "Anyone can create a recognition event" on public.recognition_events;
drop policy if exists "Anyone can create a review request"    on public.review_requests;
drop policy if exists "Anyone can create a guest"             on public.guests;
drop policy if exists "Anyone can create a reward"            on public.rewards;
drop policy if exists "Anyone can create a wallet pass"       on public.wallet_passes;
drop policy if exists "Anyone can create a visit"             on public.visits;

-- Broad anon SELECTs — prevented cross-restaurant enumeration of staff / bands.
drop policy if exists "Public can read active staff profiles" on public.staff;
drop policy if exists "Public can resolve active nfc tags"     on public.nfc_tags;
