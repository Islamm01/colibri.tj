-- =====================================================================
-- ANJIR — Slice 12: Admin panel (zones + platform settings)
-- =====================================================================

-- Global platform settings (single row, id = 1). Things the admin tunes
-- without a code deploy: parcel pricing, min order, dispatch radius, etc.
create table if not exists platform_settings (
  id int primary key default 1 check (id = 1),
  parcel_base_fare numeric(10,2) not null default 15,
  parcel_base_km numeric(10,2) not null default 2,
  parcel_per_km numeric(10,2) not null default 4,
  parcel_heavy_surcharge numeric(10,2) not null default 10,
  parcel_max_km numeric(10,2) not null default 25,
  fruit_delivery_fee numeric(10,2) not null default 10,
  fruit_free_delivery_over numeric(10,2),     -- null = never free
  default_commission_rate numeric(4,3) not null default 0.10,
  support_telegram text default 'anjir_support',
  updated_at timestamptz not null default now()
);

insert into platform_settings (id) values (1) on conflict (id) do nothing;

-- Delivery zones — extend existing table with circle-based fields.
-- The table was created in 0001 with polygon/fee columns; we add the
-- admin-panel columns here without dropping the old ones (orders still use them).
alter table delivery_zones
  add column if not exists center_lat numeric(10,6),
  add column if not exists center_lng numeric(10,6),
  add column if not exists radius_km numeric(6,2) not null default 5,
  add column if not exists fee_modifier numeric(10,2) not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order int not null default 0;

-- Seed one default zone covering central Khujand
insert into delivery_zones (name, base_fee, included_km, per_km_rate, center_lat, center_lng, radius_km, sort_order, active)
select 'Хуҷанд — марказ', 15.00, 2.00, 3.00, 40.2837, 69.6219, 10, 1, true
where not exists (select 1 from delivery_zones where name = 'Хуҷанд — марказ');
