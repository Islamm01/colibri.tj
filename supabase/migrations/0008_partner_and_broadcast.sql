-- =====================================================================
-- ANJIR — Slice 5: Partner applications + broadcast dispatch
-- =====================================================================

-- Partner applications — from prospective store owners
create table if not exists partner_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  phone text not null,
  address text,
  vertical text,           -- 'fruits' | 'pharmacy' | 'agro' | 'other'
  category text,           -- free-form: dried fruits, fresh produce, etc.
  description text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  decided_at timestamptz
);

create index if not exists idx_partner_applications_status
  on partner_applications(status, created_at desc);

-- =====================================================================
-- Broadcast dispatch mode
--
-- The dispatcher historically offered orders to ONE courier at a time
-- (sequential). At low courier volume that's wasteful — the nearest courier
-- might still be 8 km away while three others are 6 km away and idle.
--
-- Add a flag to switch behavior. When broadcast is on:
--   - On dispatch, create a pending offer for EVERY online courier
--   - Whoever accepts first wins (atomic UPDATE, same as before)
--   - All other pending offers for that order get auto-superseded
--
-- A row in this table controls the mode; we read it once per dispatch.
-- =====================================================================
create table if not exists dispatch_config (
  id int primary key default 1 check (id = 1),
  mode text not null default 'broadcast' check (mode in ('sequential', 'broadcast')),
  updated_at timestamptz not null default now()
);

insert into dispatch_config (id, mode) values (1, 'broadcast')
on conflict (id) do nothing;
