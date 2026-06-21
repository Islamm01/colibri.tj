// =====================================================================
// Colibri — Settlement read queries (no writes)
//
// Shared by the admin settlement dashboard (Stage 3) and the store-facing
// earnings view (Stage 4). All money is summed in integer diram via the
// helpers in ./amounts so there is never floating-point drift.
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { storeEarning, sumSomoni, toDiram, fromDiram } from './amounts';

// "online-paid OR cash" for store settlement (see SETTLEABLE_ORDER_SQL).

// PostgREST form of "online-paid OR cash" — pairs with the .eq('status','delivered')
// and .is('settled_at', null) filters to mirror isSettleableStoreOrder().
const SETTLEABLE_OR = 'payment_status.eq.paid,payment_method.eq.cash';

export interface OutstandingOrder {
  public_code: string;
  created_at: string;
  delivered_at: string | null;
  subtotal: number;
  commission: number;
  store_earning: number;
  payment_method: string;
}

export interface StoreOutstanding {
  amount: number; // somoni
  order_count: number;
  orders: OutstandingOrder[];
}

export interface StoreLifetime {
  paid_out: number;
  commission_earned: number;
  payout_count: number;
  last_payout_at: string | null;
}

/** Unsettled, settleable orders for one store + their total store earning. */
export async function getStoreOutstanding(
  supabase: SupabaseClient,
  storeId: string,
): Promise<StoreOutstanding> {
  const { data } = await supabase
    .from('orders')
    .select('public_code, created_at, delivered_at, subtotal, commission, payment_method')
    .eq('store_id', storeId)
    .eq('status', 'delivered')
    .is('settled_at', null)
    .or(SETTLEABLE_OR)
    .order('delivered_at', { ascending: true });

  const orders: OutstandingOrder[] = (data ?? []).map((o) => ({
    public_code: o.public_code,
    created_at: o.created_at,
    delivered_at: o.delivered_at,
    subtotal: Number(o.subtotal),
    commission: Number(o.commission),
    store_earning: storeEarning(o),
    payment_method: o.payment_method,
  }));

  return {
    amount: sumSomoni(orders.map((o) => o.store_earning)),
    order_count: orders.length,
    orders,
  };
}

/** Lifetime paid-out + commission-earned totals for one store. */
export async function getStoreLifetime(
  supabase: SupabaseClient,
  storeId: string,
): Promise<StoreLifetime> {
  const [{ data: payouts }, { data: delivered }] = await Promise.all([
    supabase
      .from('payouts')
      .select('amount, status, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('commission')
      .eq('store_id', storeId)
      .eq('status', 'delivered')
      .or(SETTLEABLE_OR),
  ]);

  const paidRows = (payouts ?? []).filter((p) => p.status === 'paid');
  return {
    paid_out: sumSomoni(paidRows.map((p) => p.amount)),
    commission_earned: sumSomoni((delivered ?? []).map((o) => o.commission)),
    payout_count: paidRows.length,
    last_payout_at: (payouts ?? [])[0]?.created_at ?? null,
  };
}

export interface RecentEarningOrder {
  public_code: string;
  created_at: string;
  delivered_at: string | null;
  subtotal: number;
  commission: number;
  store_earning: number;
  settled: boolean;
}

/** Recent settleable orders for a store, with per-order earning and whether
 *  they've already been paid out — for the transparent store-facing view. */
export async function getStoreRecentOrders(
  supabase: SupabaseClient,
  storeId: string,
  limit = 20,
): Promise<RecentEarningOrder[]> {
  const { data } = await supabase
    .from('orders')
    .select('public_code, created_at, delivered_at, subtotal, commission, settled_at')
    .eq('store_id', storeId)
    .eq('status', 'delivered')
    .or(SETTLEABLE_OR)
    .order('delivered_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((o) => ({
    public_code: o.public_code,
    created_at: o.created_at,
    delivered_at: o.delivered_at,
    subtotal: Number(o.subtotal),
    commission: Number(o.commission),
    store_earning: storeEarning(o),
    settled: !!o.settled_at,
  }));
}

export interface SettlementOverviewRow {
  store_id: string;
  name: string;
  outstanding: number;
  order_count: number;
  last_payout_at: string | null;
  last_payout_amount: number | null;
}

/** "What do we owe everyone right now" — one row per store. */
export async function getSettlementOverview(supabase: SupabaseClient): Promise<{
  stores: SettlementOverviewRow[];
  total_outstanding: number;
  stores_with_balance: number;
}> {
  const [{ data: stores }, { data: orders }, { data: payouts }] = await Promise.all([
    supabase.from('stores').select('id, name').order('name', { ascending: true }),
    supabase
      .from('orders')
      .select('store_id, subtotal, commission')
      .not('store_id', 'is', null)
      .eq('status', 'delivered')
      .is('settled_at', null)
      .or(SETTLEABLE_OR),
    supabase
      .from('payouts')
      .select('store_id, amount, created_at, status')
      .order('created_at', { ascending: false }),
  ]);

  // Outstanding balance per store, summed in exact diram.
  const balByStore = new Map<string, { diram: number; n: number }>();
  for (const o of orders ?? []) {
    const earn = toDiram(o.subtotal) - toDiram(o.commission);
    const cur = balByStore.get(o.store_id) ?? { diram: 0, n: 0 };
    cur.diram += earn;
    cur.n += 1;
    balByStore.set(o.store_id, cur);
  }

  // Most recent payout per store (payouts already sorted newest-first).
  const lastPayout = new Map<string, { created_at: string; amount: number }>();
  for (const p of payouts ?? []) {
    if (!lastPayout.has(p.store_id)) {
      lastPayout.set(p.store_id, { created_at: p.created_at, amount: Number(p.amount) });
    }
  }

  const rows: SettlementOverviewRow[] = (stores ?? []).map((s) => {
    const b = balByStore.get(s.id);
    const lp = lastPayout.get(s.id);
    return {
      store_id: s.id,
      name: s.name,
      outstanding: b ? fromDiram(b.diram) : 0,
      order_count: b?.n ?? 0,
      last_payout_at: lp?.created_at ?? null,
      last_payout_amount: lp?.amount ?? null,
    };
  });

  // Highest balance first so the operator sees who's owed most.
  rows.sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));

  return {
    stores: rows,
    total_outstanding: sumSomoni(rows.map((r) => r.outstanding)),
    stores_with_balance: rows.filter((r) => r.outstanding > 0).length,
  };
}

// ---------------------------------------------------------------------
// Courier COD cash reconciliation (separate ledger — Stage 5)
// ---------------------------------------------------------------------

export interface CourierCashRow {
  courier_id: string;
  name: string;
  phone: string | null;
  outstanding: number; // Σ total of unreconciled delivered cash orders
  order_count: number;
  last_deposit_at: string | null;
}

export interface CashDepositRow {
  id: string;
  courier_id: string;
  courier_name: string;
  amount: number;
  order_count: number;
  status: string;
  reference: string | null;
  note: string | null;
  created_at: string;
}

/** Per-courier cash collected (owed to Colibri) + recent deposit history. */
export async function getCourierCashOverview(supabase: SupabaseClient): Promise<{
  couriers: CourierCashRow[];
  total_outstanding: number;
  deposits: CashDepositRow[];
}> {
  const [{ data: orders }, { data: deposits }] = await Promise.all([
    supabase
      .from('orders')
      .select('courier_id, total')
      .eq('payment_method', 'cash')
      .eq('status', 'delivered')
      .is('cash_reconciled_at', null)
      .not('courier_id', 'is', null),
    supabase
      .from('courier_cash_deposits')
      .select('id, courier_id, amount, order_count, status, reference, note, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Outstanding cash per courier, summed in exact diram.
  const byCourier = new Map<string, { diram: number; n: number }>();
  for (const o of orders ?? []) {
    const cur = byCourier.get(o.courier_id) ?? { diram: 0, n: 0 };
    cur.diram += toDiram(o.total);
    cur.n += 1;
    byCourier.set(o.courier_id, cur);
  }

  // Resolve courier names/phones for everyone who appears.
  const ids = Array.from(
    new Set([...byCourier.keys(), ...(deposits ?? []).map((d) => d.courier_id)]),
  );
  const userMap = new Map<string, { name: string; phone: string | null }>();
  if (ids.length) {
    const { data: users } = await supabase.from('users').select('id, name, phone').in('id', ids);
    for (const u of users ?? []) userMap.set(u.id, { name: u.name, phone: u.phone ?? null });
  }

  const lastDeposit = new Map<string, string>();
  for (const d of deposits ?? []) {
    if (!lastDeposit.has(d.courier_id)) lastDeposit.set(d.courier_id, d.created_at);
  }

  const couriers: CourierCashRow[] = Array.from(byCourier.entries())
    .map(([courier_id, b]) => ({
      courier_id,
      name: userMap.get(courier_id)?.name ?? 'Курьер',
      phone: userMap.get(courier_id)?.phone ?? null,
      outstanding: fromDiram(b.diram),
      order_count: b.n,
      last_deposit_at: lastDeposit.get(courier_id) ?? null,
    }))
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));

  const depositRows: CashDepositRow[] = (deposits ?? []).map((d) => ({
    id: d.id,
    courier_id: d.courier_id,
    courier_name: userMap.get(d.courier_id)?.name ?? 'Курьер',
    amount: Number(d.amount),
    order_count: d.order_count,
    status: d.status,
    reference: d.reference,
    note: d.note,
    created_at: d.created_at,
  }));

  return {
    couriers,
    total_outstanding: sumSomoni(couriers.map((c) => c.outstanding)),
    deposits: depositRows,
  };
}
