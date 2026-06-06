-- =====================================================================
-- ANJIR — Initial schema
-- Built for future expansion: fruits, parcel, pharmacy, agro, garden, farmers
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
-- PostGIS optional for v1 (we use lat/lng floats); enable when adding geo queries
-- create extension if not exists postgis;

-- =====================================================================
-- ENUMS
-- =====================================================================

create type vertical_type as enum (
  'fruits',
  'parcel',
  'pharmacy',
  'agro',
  'garden',
  'farmers'
);

create type user_role as enum (
  'customer',
  'store_owner',
  'courier',
  'operator',
  'admin',
  'system'
);

create type order_status as enum (
  'pending_payment',
  'placed',
  'accepted',
  'preparing',
  'ready',
  'courier_assigned',
  'picked_up',
  'delivered',
  'cancelled'
);

create type courier_status as enum (
  'offline',
  'online',
  'on_delivery'
);

create type payment_method as enum (
  'cash',
  'qr',
  'bank_transfer'
);

create type payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded'
);

create type product_unit as enum (
  'kg',
  'piece',
  'pack',
  'gram'
);

-- =====================================================================
-- USERS
-- Customer "soft accounts" have NULL password_hash and are identified by phone.
-- Staff (store_owner, courier, operator, admin) have password_hash.
-- =====================================================================

create table users (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  name text,
  role user_role not null default 'customer',
  password_hash text,
  locale text not null default 'tj',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_must_have_password
    check (role = 'customer' or password_hash is not null)
);

create index idx_users_phone on users(phone);
create index idx_users_role on users(role);

-- =====================================================================
-- STORES
-- A store belongs to a vertical. Future verticals just insert with a different vertical value.
-- =====================================================================

create table stores (
  id uuid primary key default uuid_generate_v4(),
  vertical vertical_type not null,
  category text, -- e.g. 'fresh', 'dried', 'mixed' — vertical-specific subdivision
  name text not null,
  slug text unique not null,
  description_tj text,
  description_ru text,
  owner_id uuid references users(id) on delete set null,
  cover_image_url text,
  logo_url text,
  lat double precision not null,
  lng double precision not null,
  address text,

  -- Operating hours: { "mon": ["08:00", "22:00"], "tue": [...], ... } or null = always open
  opening_hours jsonb,
  is_paused boolean not null default false,
  is_active boolean not null default true,

  -- Commerce
  commission_rate numeric(5, 4) not null default 0.10, -- 10% default
  min_order_amount numeric(10, 2) not null default 0,
  prep_time_minutes int not null default 10,

  rating numeric(3, 2),
  rating_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stores_vertical on stores(vertical) where is_active = true;
create index idx_stores_slug on stores(slug);

-- =====================================================================
-- PRODUCTS
-- Bilingual fields. Image stored as JSON array of { url, w, h }.
-- =====================================================================

create table products (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  name_tj text not null,
  name_ru text not null,
  description_tj text,
  description_ru text,
  category text, -- 'fresh', 'dried', 'berries', 'citrus' etc.
  price numeric(10, 2) not null check (price >= 0),
  unit product_unit not null default 'kg',
  stock numeric(10, 2), -- null = unlimited; otherwise stock count in `unit`
  images jsonb not null default '[]'::jsonb,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_store on products(store_id) where is_available = true;
create index idx_products_category on products(category);

-- =====================================================================
-- ADDRESSES
-- user_id nullable: guest checkout addresses live here, linked via order.address_id.
-- =====================================================================

create table addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  label text, -- "Home", "Office", or null for guest
  formatted_address text not null,
  details text, -- apartment, floor, intercom code
  lat double precision not null,
  lng double precision not null,
  phone text,
  created_at timestamptz not null default now()
);

create index idx_addresses_user on addresses(user_id);

-- =====================================================================
-- DELIVERY ZONES
-- Hybrid pricing: each zone has a base fee + per-km rate + included km.
-- =====================================================================

create table delivery_zones (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- GeoJSON polygon as text for now; switch to geography(Polygon) when enabling PostGIS
  polygon_geojson jsonb,
  base_fee numeric(10, 2) not null default 15.00,
  included_km numeric(5, 2) not null default 2.00,
  per_km_rate numeric(10, 2) not null default 3.00,
  free_delivery_threshold numeric(10, 2) default 150.00,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- ORDERS
-- public_code is the shareable, human-friendly tracking code (e.g. ANJ-7K2P).
-- =====================================================================

create table orders (
  id uuid primary key default uuid_generate_v4(),
  public_code text unique not null,

  -- Customer (works with or without an account)
  customer_user_id uuid references users(id) on delete set null,
  customer_phone text not null,
  customer_name text not null,

  -- Which vertical this order belongs to (fruits, parcel, pharmacy, ...).
  -- Defaulted so fruit orders that don't set it explicitly are correct.
  vertical vertical_type not null default 'fruits',

  -- Store + delivery
  store_id uuid not null references stores(id),
  address_id uuid not null references addresses(id),

  -- Money
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  commission numeric(10, 2) not null default 0, -- platform cut

  -- Payment
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',

  -- Status + assignment
  status order_status not null default 'placed',
  courier_id uuid references users(id) on delete set null,

  -- Customer notes
  notes text,

  -- ETA tracking
  prep_eta_minutes int,
  delivery_eta_minutes int,

  -- Timestamps for the lifecycle
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create index idx_orders_store_status on orders(store_id, status);
create index idx_orders_courier on orders(courier_id) where courier_id is not null;
create index idx_orders_customer_phone on orders(customer_phone);
create index idx_orders_public_code on orders(public_code);
create index idx_orders_created on orders(created_at desc);

-- =====================================================================
-- ORDER ITEMS
-- Snapshot fields prevent retroactive price/name changes.
-- =====================================================================

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  name_snapshot text not null,
  price_snapshot numeric(10, 2) not null,
  unit_snapshot product_unit not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  subtotal numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index idx_order_items_order on order_items(order_id);

-- =====================================================================
-- COURIERS
-- One row per courier user. Tracks live position and current state.
-- =====================================================================

create table couriers (
  user_id uuid primary key references users(id) on delete cascade,
  status courier_status not null default 'offline',
  vehicle_type text default 'bike',
  last_lat double precision,
  last_lng double precision,
  last_ping_at timestamptz,
  current_order_id uuid references orders(id) on delete set null,
  total_deliveries int not null default 0,
  rating numeric(3, 2),
  created_at timestamptz not null default now()
);

create index idx_couriers_status on couriers(status) where status = 'online';

-- =====================================================================
-- ORDER EVENTS — append-only audit log
-- Powers analytics, dispute resolution, and "what happened?" debugging.
-- =====================================================================

create table order_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  event_type text not null,
  actor_id uuid references users(id),
  actor_role user_role,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_order_events_order on order_events(order_id, created_at);

-- =====================================================================
-- COMMISSION RULES
-- Global default + per-store overrides + time-bound promotional rates.
-- =====================================================================

create table commission_rules (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references stores(id) on delete cascade,
  vertical vertical_type,
  rate numeric(5, 4) not null,
  active_from timestamptz not null default now(),
  active_to timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- WAITLIST
-- Pre-launch interest capture for future verticals.
-- =====================================================================

create table waitlist (
  id uuid primary key default uuid_generate_v4(),
  vertical vertical_type not null,
  phone text not null,
  type text not null check (type in ('customer', 'partner')),
  notes text,
  created_at timestamptz not null default now(),
  unique (vertical, phone, type)
);

create index idx_waitlist_vertical on waitlist(vertical, type);

-- =====================================================================
-- updated_at trigger
-- =====================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();
create trigger trg_stores_updated before update on stores
  for each row execute function set_updated_at();
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();
