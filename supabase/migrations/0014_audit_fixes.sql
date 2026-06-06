-- =====================================================================
-- Colibri — Slice 14 / audit fixes (idempotent, safe to run anytime)
--
-- Two corrections found in a full migration audit. Safe on both a fresh
-- database (where 0001 already contains the fixes) and an existing one
-- (where 0001 ran before the fixes existed). Every statement is guarded.
--
--   FIX 1  orders.vertical — guaranteed to exist (0007 indexed it before any
--          migration created it). 0010 already adds it; this re-asserts it so
--          databases that never ran 0010 are also covered.
--
--   FIX 2  user_role enum needs a 'system' value. The payments webhook writes
--          order_events.actor_role = 'system' for automated confirmations;
--          without this value that insert fails with an enum violation.
-- =====================================================================

-- FIX 1 — orders.vertical column present (no-op if already there)
alter table orders
  add column if not exists vertical vertical_type not null default 'fruits';

create index if not exists idx_orders_vertical_status
  on orders(vertical, status, created_at desc)
  where status not in ('delivered', 'cancelled');

-- FIX 2 — add 'system' to user_role enum if missing
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'system'
  ) then
    alter type user_role add value 'system';
  end if;
end $$;
