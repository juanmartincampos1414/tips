-- =============================================================================
-- Tips · Phase 0 — Tenant Isolation foundation (DB side)
--
-- Backstop primitives + tips/ratings → DIRECT. The app uses the service-role
-- client (bypasses RLS), so these RLS changes do NOT alter app behavior — they
-- are the second-layer backstop for the authed-client / direct-API surface, and
-- they prepare for membership-based access. The owner→member conversion of the
-- OTHER tables' policies happens incrementally per migration tier (a semantic
-- change tied to each domain), not in one big-bang here.
-- =============================================================================

-- 1) Membership predicates (security definer so they can read restaurant_members
--    regardless of that table's own RLS). search_path pinned for safety.
create or replace function public.is_member(rid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(rid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- 2) tips + ratings → DIRECT (add restaurant_id nullable + backfill via staff).
--    NOT NULL is deferred until Tier 5 updates the insert sites (no risk to the
--    live recognition flow).
alter table public.tips
  add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.ratings
  add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;

update public.tips t
  set restaurant_id = s.restaurant_id
  from public.staff s
  where t.staff_id = s.id and t.restaurant_id is null;
update public.ratings r
  set restaurant_id = s.restaurant_id
  from public.staff s
  where r.staff_id = s.id and r.restaurant_id is null;

create index if not exists tips_restaurant_idx    on public.tips (restaurant_id);
create index if not exists ratings_restaurant_idx on public.ratings (restaurant_id);

-- 3) tips/ratings policies → membership-based (they now have restaurant_id).
drop policy if exists "Owners read their tips"    on public.tips;
drop policy if exists "Owners read their ratings" on public.ratings;
create policy "Members read tips"
  on public.tips for select using (public.is_member(restaurant_id));
create policy "Members read ratings"
  on public.ratings for select using (public.is_member(restaurant_id));
