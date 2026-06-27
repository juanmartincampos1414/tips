-- =============================================================================
-- Tips · Tier 2 (payments) — RLS owner→member conversion for the payments domain.
--
-- Backstop only (the app uses the tenant-scoped DAL on the service-role client,
-- which bypasses RLS). Converts payments / payment_events / staff_settlements /
-- restaurant_payouts / payment_intents policies to the is_member predicate from
-- 0020. payment_intents has no restaurant_id → scoped via its parent payment.
-- =============================================================================

drop policy if exists "Owners read their payments" on public.payments;
drop policy if exists "Members read payments" on public.payments;
create policy "Members read payments"
  on public.payments for select using (public.is_member(restaurant_id));

drop policy if exists "Owners read their payment events" on public.payment_events;
drop policy if exists "Members read payment events" on public.payment_events;
create policy "Members read payment events"
  on public.payment_events for select using (public.is_member(restaurant_id));

drop policy if exists "Owners read their settlements" on public.staff_settlements;
drop policy if exists "Members read settlements" on public.staff_settlements;
create policy "Members read settlements"
  on public.staff_settlements for select using (public.is_member(restaurant_id));

drop policy if exists "Owners read their payouts" on public.restaurant_payouts;
drop policy if exists "Members read payouts" on public.restaurant_payouts;
create policy "Members read payouts"
  on public.restaurant_payouts for select using (public.is_member(restaurant_id));

-- payment_intents: CHILD (no restaurant_id) → via the parent payment.
drop policy if exists "Owners read their payment intents" on public.payment_intents;
drop policy if exists "Members read payment intents" on public.payment_intents;
create policy "Members read payment intents"
  on public.payment_intents for select using (
    exists (
      select 1 from public.payments p
      where p.id = payment_intents.payment_id and public.is_member(p.restaurant_id)
    )
  );
