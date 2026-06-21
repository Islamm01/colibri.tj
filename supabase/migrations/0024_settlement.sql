-- =====================================================================
-- Colibri — Stage 1: Settlement ledger & store payouts (aggregator model)
--
-- Colibri collects ALL customer money (online to Colibri's account, or cash
-- collected by the courier on Colibri's behalf). Colibri keeps the goods
-- commission and the delivery margin, and on a weekly cycle pays each store
--   storeEarning = subtotal - commission.
--
-- This layer RECORDS what is owed and what has been paid. It does NOT move
-- real money. // TODO: future — automated payouts via provider.
--
-- Money is exact `numeric`; storeEarning is a difference of two 2-dp values,
-- so it needs no rounding. No floating point anywhere.
-- Additive, idempotent, guarded. Latest prior migration: 0023.
-- =====================================================================

-- 1) payouts — one row per recorded payout to a store -----------------
create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id),
  amount numeric(12,2) not null default 0,         -- Σ storeEarning settled here
  order_count int not null default 0,
  period_start timestamptz,                         -- informational window
  period_end timestamptz,
  status text not null default 'paid' check (status in ('pending', 'paid', 'void')),
  reference text,                                   -- admin-entered bank ref
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_payouts_store on payouts(store_id, created_at desc);

-- 2) settlement marking on orders -------------------------------------
alter table orders
  add column if not exists settled_at timestamptz,
  add column if not exists payout_id uuid references payouts(id) on delete set null;

-- Fast "what's still unsettled for this store" lookups
create index if not exists idx_orders_unsettled
  on orders(store_id) where settled_at is null;

-- 3) immutability guard — once settled, the money fields are frozen ----
create or replace function colibri_freeze_settled_order()
returns trigger language plpgsql as $$
begin
  if old.settled_at is not null
     and (new.subtotal   is distinct from old.subtotal
       or new.commission is distinct from old.commission) then
    raise exception 'order % is settled; subtotal/commission are immutable', old.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_freeze_settled_order on orders;
create trigger trg_freeze_settled_order
  before update on orders
  for each row execute function colibri_freeze_settled_order();

-- 4) record_store_payout — atomic, idempotent settle ------------------
-- Claims a store's currently-unsettled, settleable orders, creates a payout,
-- marks those orders settled, and returns the payout (all in one transaction).
--
-- Settleable = belongs to a store AND status='delivered' AND
--   (payment_status='paid' OR payment_method='cash')
-- COD cash is collected by the courier on Colibri's behalf, so a delivered
-- cash order counts as paid-to-Colibri even though payment_status stays
-- 'pending' in the current flow. Parcels (store_id null) never settle.
--
-- No double-settle: the UPDATE ... WHERE settled_at IS NULL takes row locks,
-- so a concurrent second call claims zero rows and returns NULL.
create or replace function record_store_payout(
  p_store_id uuid,
  p_created_by uuid,
  p_reference text default null,
  p_note text default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null
) returns payouts language plpgsql as $$
declare
  v_payout payouts;
  v_amount numeric(12,2);
  v_count  int;
begin
  -- Create the payout shell first so claimed orders can reference its id.
  insert into payouts (store_id, amount, order_count, period_start, period_end,
                       status, reference, note, created_by, paid_at)
  values (p_store_id, 0, 0, p_period_start, p_period_end,
          'paid', p_reference, p_note, p_created_by, now())
  returning * into v_payout;

  -- Atomically claim every currently-unsettled settleable order for this store.
  with claimed as (
    update orders o
       set settled_at = now(), payout_id = v_payout.id
     where o.store_id = p_store_id
       and o.settled_at is null
       and o.status = 'delivered'
       and (o.payment_status = 'paid' or o.payment_method = 'cash')
    returning (o.subtotal - o.commission) as earning
  )
  select coalesce(sum(earning), 0), count(*) into v_amount, v_count from claimed;

  if v_count = 0 then
    -- Nothing to settle (already paid out / no eligible orders). Leave no
    -- empty payout behind, and signal the caller with NULL.
    delete from payouts where id = v_payout.id;
    return null;
  end if;

  update payouts set amount = v_amount, order_count = v_count where id = v_payout.id;

  v_payout.amount := v_amount;
  v_payout.order_count := v_count;
  return v_payout;
end $$;
