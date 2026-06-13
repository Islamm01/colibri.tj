-- =====================================================================
-- Colibri — Slice 2: Wholesale / bulk listings
--
-- Adds a 'ton' unit for selling in serious volume, plus two optional
-- product flags so a listing can be marked as wholesale with a minimum
-- order quantity. Fully idempotent; safe to re-run.
--
-- NOTE: retail products are unaffected — both columns default to a
-- non-wholesale, no-minimum state.
-- =====================================================================

-- 1. Add 'ton' to the product_unit enum (guarded, mirrors existing pattern)
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'product_unit' and e.enumlabel = 'ton'
  ) then
    alter type product_unit add value 'ton';
  end if;
end $$;

-- 2. Wholesale flags on products
alter table products
  add column if not exists is_wholesale boolean not null default false;

alter table products
  add column if not exists min_quantity numeric;  -- null = no minimum

-- Helpful for filtering wholesale listings later (B2B Phase 3)
create index if not exists idx_products_wholesale
  on products(store_id)
  where is_wholesale = true;
