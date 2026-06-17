-- =====================================================================
-- Colibri — Price Index RLS fix
--
-- ROOT CAUSE of "daily prices don't appear on the website":
-- `price_index` had Row Level Security ENABLED (via the Supabase dashboard)
-- but NO select policy for the `anon` role. The admin/operator editor reads
-- with the service-role key (bypasses RLS) so it always saw the data, while
-- the public website reads with the anon key and got ZERO rows back — RLS
-- with no policy returns an empty set, not an error, so the failure was
-- silent.
--
-- Every other public-read table in this schema enables RLS *and* adds a
-- "public read" policy (see 0002_checkout_and_orders.sql). price_index was
-- the one table missing its policy. This migration restores the convention.
-- =====================================================================

alter table price_index enable row level security;

-- Published rows are public — anyone may read them (anon + authenticated).
drop policy if exists "public read price_index" on price_index;
create policy "public read price_index"
  on price_index for select
  using (is_published = true);

-- All writes continue to go through the service-role key in API routes,
-- which bypasses RLS. No insert/update/delete policy is granted to anon.
