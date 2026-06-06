-- =====================================================================
-- ANJIR — Slice 4b: courier app + sequential dispatch
-- =====================================================================

-- =====================================================================
-- DELIVERY OFFERS — the dispatch state machine
-- One row per offer made to a courier for a specific order.
-- =====================================================================

create type offer_status as enum (
  'pending',
  'accepted',
  'rejected',
  'expired'
);

create table if not exists delivery_offers (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  courier_id uuid not null references users(id) on delete cascade,
  status offer_status not null default 'pending',
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 seconds'),
  cycle int not null default 1, -- which round of dispatch this is for the order
  distance_km numeric(6, 2),
  created_at timestamptz not null default now()
);

-- One active offer per order at a time
create unique index if not exists idx_one_active_offer_per_order
  on delivery_offers(order_id)
  where status = 'pending';

-- Find pending offer for a courier quickly
create index if not exists idx_active_offer_per_courier
  on delivery_offers(courier_id)
  where status = 'pending';

-- =====================================================================
-- Dispatch state on the order itself
-- Tracks the dispatch cycle count and whether dispatch has failed.
-- =====================================================================

alter table orders
  add column if not exists dispatch_attempts int not null default 0,
  add column if not exists dispatch_failed boolean not null default false;

-- =====================================================================
-- Replica identity FULL for realtime on the new tables
-- =====================================================================

alter table delivery_offers replica identity full;
alter table couriers replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table delivery_offers;
    exception when undefined_object then null;
    end;
    alter publication supabase_realtime add table delivery_offers;

    begin
      alter publication supabase_realtime drop table couriers;
    exception when undefined_object then null;
    end;
    alter publication supabase_realtime add table couriers;
  end if;
end $$;

-- =====================================================================
-- RLS policies — operate via service role from API, but allow anon reads
-- for couriers/offers so realtime subscriptions get the rows.
-- =====================================================================

alter table delivery_offers enable row level security;
alter table couriers enable row level security;

drop policy if exists "public read offers" on delivery_offers;
create policy "public read offers" on delivery_offers for select using (true);

drop policy if exists "service write offers" on delivery_offers;
create policy "service write offers" on delivery_offers for all using (true) with check (true);

drop policy if exists "public read couriers" on couriers;
create policy "public read couriers" on couriers for select using (true);

drop policy if exists "service write couriers" on couriers;
create policy "service write couriers" on couriers for all using (true) with check (true);

-- =====================================================================
-- Seed: courier user
--
-- Phone: +992900000002
-- Password: anjir2025 (same hash as other staff users)
-- =====================================================================

insert into users (id, phone, name, role, password_hash, locale)
values (
  '44444444-4444-4444-4444-444444444444',
  '+992900000002',
  'Демо Паёмбар',
  'courier',
  'pbkdf2$600000$YW5qaXJfZGVtb19zYWx0Xw$U5Y3sfPC7I6JOGp2P7P-wpPMAu2G7NugWkMd5V_7fQs',
  'ru'
)
on conflict (phone) do nothing;

-- Create the matching couriers row
insert into couriers (user_id, status, vehicle_type)
values (
  '44444444-4444-4444-4444-444444444444',
  'offline',
  'bike'
)
on conflict (user_id) do nothing;
