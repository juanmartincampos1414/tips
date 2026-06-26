-- =============================================================================
-- Tips · Tier 1 (guests) — RLS owner→member conversion for the guests domain.
--
-- Backstop only (the app accesses data via the tenant-scoped DAL on the
-- service-role client, which bypasses RLS). Converts the guests / guest_notes /
-- guest_tags policies from owner-scoped to is_member, consistent with the
-- membership predicates from 0020.
-- =============================================================================

drop policy if exists "Owners read their guests" on public.guests;
create policy "Members read guests"
  on public.guests for select using (public.is_member(restaurant_id));

drop policy if exists "Owners manage guest notes" on public.guest_notes;
create policy "Members manage guest notes"
  on public.guest_notes for all
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));

drop policy if exists "Owners manage guest tags" on public.guest_tags;
create policy "Members manage guest tags"
  on public.guest_tags for all
  using (public.is_member(restaurant_id))
  with check (public.is_member(restaurant_id));
