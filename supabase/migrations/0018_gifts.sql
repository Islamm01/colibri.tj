-- =====================================================================
-- Colibri — Gifts by Colibri (third consumer pillar)
--
-- Adds a 'gifts' vertical, optional gift metadata on products, optional
-- gift fields on orders (null for retail/parcel), and a custom-set
-- request queue. Fully idempotent; safe to re-run.
--
-- The Gifts storefront is a CURATED brand: the customer sees one
-- "Gifts by Colibri", powered behind the scenes by one (or few) stores
-- with vertical = 'gifts'. A gift "set" is a normal product row whose
-- `category` holds a gift TYPE and `occasion` holds occasion tags.
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
--    `category` (existing column) carries the gift TYPE for gift products:
--      fruit_basket | dried_basket | honey | honey_nuts | honey_dried | gift_box
--    `occasion` carries occasion tags: holiday | corporate | custom
alter table products
  add column if not exists occasion text[];          -- occasion tags

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

-- 4. Custom gift-set requests (Phase 1 of "build me a set")
--    A lightweight operator-visible queue; no self-serve builder yet.
create table if not exists gift_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  phone text not null,
  budget numeric,                                     -- approximate budget in som
  occasion text,                                      -- holiday | corporate | custom | other
  preferences text,                                   -- free-text: tastes, allergies, etc.
  status text not null default 'new'
    check (status in ('new', 'contacted', 'fulfilled', 'rejected')),
  notes text,                                         -- operator notes
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  decided_at timestamptz
);

create index if not exists idx_gift_requests_status
  on gift_requests(status, created_at desc);
