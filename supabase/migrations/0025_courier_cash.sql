-- =====================================================================
-- Colibri — Stage 5: Courier COD cash reconciliation (separate ledger)
--
-- For cash orders the courier collects the full `total` from the customer ON
-- COLIBRI'S BEHALF. This ledger records how much cash each courier has
-- collected that should be handed to / deposited with Colibri, and lets an
-- admin mark it reconciled. It is a RECORD, not automated banking, and is
-- INDEPENDENT of store payouts (0024) — a cash order is owed to the store AND
-- its cash is owed by the courier; the two ledgers never block each other.
--
-- // TODO: future — courier cash deposit tracking detail (denominations,
-- // partial deposits, shortfalls) if it grows.
--
-- Additive, idempotent, guarded. Does not depend on 0024.
-- =====================================================================

-- 1) courier_cash_deposits — one row per recorded hand-over -----------
create table if not exists courier_cash_deposits (
  id uuid primary key default uuid_generate_v4(),
  courier_id uuid not null references users(id),
  amount numeric(12,2) not null default 0,         -- Σ total of cash orders reconciled
  order_count int not null default 0,
  status text not null default 'reconciled' check (status in ('pending', 'reconciled', 'void')),
  reference text,
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz
);

create index if not exists idx_cash_deposits_courier
  on courier_cash_deposits(courier_id, created_at desc);

-- 2) reconciliation marking on orders ---------------------------------
alter table orders
  add column if not exists cash_reconciled_at timestamptz,
  add column if not exists cash_deposit_id uuid references courier_cash_deposits(id) on delete set null;

create index if not exists idx_orders_unreconciled_cash
  on orders(courier_id) where cash_reconciled_at is null;

-- 3) record_courier_cash_deposit — atomic, idempotent -----------------
-- Claims a courier's currently-unreconciled cash orders (delivered, cash),
-- creates a deposit row summing their `total`, and marks them reconciled — all
-- in one transaction. Reconcilable = has a courier AND payment_method='cash'
-- AND status='delivered'. No double-reconcile: a concurrent second call claims
-- zero rows and returns NULL.
create or replace function record_courier_cash_deposit(
  p_courier_id uuid,
  p_created_by uuid,
  p_reference text default null,
  p_note text default null
) returns courier_cash_deposits language plpgsql as $$
declare
  v_dep    courier_cash_deposits;
  v_amount numeric(12,2);
  v_count  int;
begin
  insert into courier_cash_deposits (courier_id, amount, order_count, status,
                                     reference, note, created_by, reconciled_at)
  values (p_courier_id, 0, 0, 'reconciled', p_reference, p_note, p_created_by, now())
  returning * into v_dep;

  with claimed as (
    update orders o
       set cash_reconciled_at = now(), cash_deposit_id = v_dep.id
     where o.courier_id = p_courier_id
       and o.cash_reconciled_at is null
       and o.payment_method = 'cash'
       and o.status = 'delivered'
    returning o.total as amt
  )
  select coalesce(sum(amt), 0), count(*) into v_amount, v_count from claimed;

  if v_count = 0 then
    delete from courier_cash_deposits where id = v_dep.id;
    return null;
  end if;

  update courier_cash_deposits set amount = v_amount, order_count = v_count where id = v_dep.id;
  v_dep.amount := v_amount;
  v_dep.order_count := v_count;
  return v_dep;
end $$;
