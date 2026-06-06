-- =====================================================================
-- ANJIR — Slice 4d: Parcel delivery
--
-- Parcels are first-class orders in the same `orders` table, but:
--   - store_id is NULL (no store fulfills a parcel)
--   - pickup_address_id is set (the sender's address)
--   - address_id (now interpreted as DROPOFF address)
--   - parcel_details holds the sender/recipient/contents info as JSONB
--   - vertical = 'parcel'
--   - status starts at 'accepted' (auto-accepted, no store to wait on)
--
-- This keeps the dispatcher, realtime, tracking, courier UI all reusable.
-- =====================================================================

-- store_id becomes nullable so parcels can omit it
alter table orders alter column store_id drop not null;

-- New columns
alter table orders
  add column if not exists pickup_address_id uuid references addresses(id),
  add column if not exists parcel_details jsonb,
  add column if not exists cash_payer text check (cash_payer in ('sender', 'recipient'));

-- Helpful index for the operator/courier views that filter by vertical
create index if not exists idx_orders_vertical_status
  on orders(vertical, status, created_at desc)
  where status not in ('delivered', 'cancelled');

-- Parcel addresses don't need to live in delivery_zones — addresses are free-form
-- (we already allow that). No further constraints needed.
