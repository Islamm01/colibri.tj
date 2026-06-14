-- =====================================================================
-- Colibri — Gifts by Colibri (third consumer pillar)
--
-- Adds a 'gifts' vertical, optional gift metadata on products, optional
-- gift fields on orders (null for retail/parcel), and a custom-set
-- request queue. Fully idempotent; safe to re-run.
--
-- NOTE: the occasion axis and the gift_requests queue added here were
-- dropped before launch — see 0019_gifts_simplify.sql. This file is kept
-- intact to match what was already applied.
-- =====================================================================

-- 1. Add 'gifts' to the vertical_type enum (guarded, mirrors existing pattern)
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'vertical_type' and e.enumlabel = 'gifts'
  ) then
    alter type vertical_type add value 'gifts';
  end if;
end $$;

-- 2. Gift metadata on products (optional — null for non-gift products)
alter table products
  add column if not exists occasion text[];          -- occasion tags (dropped in 0019)

alter table products
  add column if not exists gift_contents text;        -- descriptive "what's inside"
-- TODO: future — itemized contents (compose a set from N linked products).

-- 3. Gift fields on orders (only set for gift orders; null for retail/parcel)
alter table orders
  add column if not exists gift_message text;

alter table orders
  add column if not exists recipient_name text;

alter table orders
  add column if not exists scheduled_date date;       -- optional requested delivery date

-- 4. Custom gift-set requests (dropped in 0019)
create table if not exists gift_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  phone text not null,
  budget numeric,
  occasion text,
  preferences text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'fulfilled', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  decided_at timestamptz
);

create index if not exists idx_gift_requests_status
  on gift_requests(status, created_at desc);
