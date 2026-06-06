-- =====================================================================
-- ANJIR — Slice 2: checkout, orders, sessions
-- Adds: idempotency, public_code generator helper, RLS policies for inserts
-- =====================================================================

-- Idempotency: client generates a UUID per checkout, prevents duplicate orders
alter table orders
  add column if not exists idempotency_key uuid;

create unique index if not exists idx_orders_idempotency
  on orders(idempotency_key)
  where idempotency_key is not null;

-- Helper to ensure public_code is unique and short
-- Format: ANJ-XXXX where X is from an unambiguous alphabet (no 0/O/1/I)
create or replace function generate_public_code() returns text as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  attempts int := 0;
begin
  loop
    code := 'ANJ-' ||
      substring(alphabet from (floor(random() * 32) + 1)::int for 1) ||
      substring(alphabet from (floor(random() * 32) + 1)::int for 1) ||
      substring(alphabet from (floor(random() * 32) + 1)::int for 1) ||
      substring(alphabet from (floor(random() * 32) + 1)::int for 1);
    if not exists (select 1 from orders where public_code = code) then
      return code;
    end if;
    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'Could not generate unique order code after 10 attempts';
    end if;
  end loop;
end;
$$ language plpgsql;

-- =====================================================================
-- Row Level Security
-- For Slice 2 we operate via the anon key from server components and route handlers,
-- so we keep tables open for insert/select via the anon role but lock down updates.
-- When we add real auth (staff dashboards) in Slice 3, we'll tighten these.
-- =====================================================================

-- Enable RLS on all relevant tables
alter table stores enable row level security;
alter table products enable row level security;
alter table delivery_zones enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;
alter table users enable row level security;
alter table waitlist enable row level security;

-- Public read for the marketplace
drop policy if exists "public read stores" on stores;
create policy "public read stores" on stores for select using (is_active = true);

drop policy if exists "public read products" on products;
create policy "public read products" on products for select using (is_available = true);

drop policy if exists "public read zones" on delivery_zones;
create policy "public read zones" on delivery_zones for select using (active = true);

-- Anyone can insert addresses (guest checkout)
drop policy if exists "anon insert addresses" on addresses;
create policy "anon insert addresses" on addresses for insert with check (true);

-- Anyone can insert orders (guest checkout)
drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders" on orders for insert with check (true);

-- Anyone can read their order by public_code (tracking page)
drop policy if exists "public read orders by code" on orders;
create policy "public read orders by code" on orders for select using (true);

-- Anyone can insert order items (during checkout)
drop policy if exists "anon insert order items" on order_items;
create policy "anon insert order items" on order_items for insert with check (true);

drop policy if exists "public read order items" on order_items;
create policy "public read order items" on order_items for select using (true);

-- Order events: insert allowed, read allowed
drop policy if exists "anon insert order events" on order_events;
create policy "anon insert order events" on order_events for insert with check (true);

drop policy if exists "public read order events" on order_events;
create policy "public read order events" on order_events for select using (true);

-- Users: insert allowed (soft account creation), read by phone allowed
drop policy if exists "anon insert customers" on users;
create policy "anon insert customers" on users for insert with check (role = 'customer');

drop policy if exists "public read customer by phone" on users;
create policy "public read customer by phone" on users for select using (role = 'customer');

-- Waitlist: anyone can insert
drop policy if exists "anon insert waitlist" on waitlist;
create policy "anon insert waitlist" on waitlist for insert with check (true);

-- =====================================================================
-- Update orders to confirm payment (mock for Slice 2)
-- In Slice 3+ this becomes operator-only via authenticated role.
-- =====================================================================

drop policy if exists "anon confirm payment" on orders;
create policy "anon confirm payment" on orders for update
  using (payment_status = 'pending')
  with check (payment_status in ('pending', 'paid'));
