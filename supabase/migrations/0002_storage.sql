-- =============================================================================
-- Tips · Storage — public media bucket for restaurant logos and staff photos.
-- Public read (so guests can see staff photos on the NFC profile); writes go
-- through the service-role client in the Tips Manager, which bypasses RLS.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('tips-media', 'tips-media', true)
on conflict (id) do nothing;
