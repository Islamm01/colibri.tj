-- =====================================================================
-- ANJIR — Slice 10: Schema safety check  (idempotent, safe to re-run)
--
-- Guarantees the orders table actually has every column the app inserts.
-- Fixes two real bugs found in production:
--   (a) parcels insert store_id = NULL  -> store_id must be nullable
--   (b) the app inserts a `vertical` column that was never actually added
--       to orders (only indexes referenced it), causing inserts to fail.
--
-- Run this whole script in the Supabase SQL editor.
-- =====================================================================

-- 1. The orders.vertical column must EXIST before anything references it.
--    (Earlier migrations created an index on it but never added the column.)
alter table orders
  add column if not exists vertical vertical_type not null default 'fruits';

-- 2. store_id must be nullable (parcels have no store)
alter table orders alter column store_id drop not null;

-- 3. Parcel columns must exist
alter table orders
  add column if not exists pickup_address_id uuid references addresses(id),
  add column if not exists parcel_details jsonb,
  add column if not exists cash_payer text,
  add column if not exists idempotency_key uuid;

-- 4. cash_payer check constraint (add only if missing)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_cash_payer_check'
  ) then
    alter table orders
      add constraint orders_cash_payer_check
      check (cash_payer is null or cash_payer in ('sender', 'recipient'));
  end if;
end $$;

-- 5. Indexes (created AFTER the columns they reference exist)
create index if not exists idx_orders_vertical_status
  on orders(vertical, status, created_at desc)
  where status not in ('delivered', 'cancelled');

create unique index if not exists uq_orders_idempotency_key
  on orders(idempotency_key)
  where idempotency_key is not null;

-- 6. Make sure 'parcel' is a valid value on the vertical enum (no-op if present)
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'vertical_type' and e.enumlabel = 'parcel'
  ) then
    alter type vertical_type add value 'parcel';
  end if;
end $$;
