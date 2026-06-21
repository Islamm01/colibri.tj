// =====================================================================
// Colibri — Settlement money math (single source of truth)
//
// Aggregator model: Colibri collects ALL customer money, keeps the goods
// commission and the delivery margin, and weekly pays out:
//   • store  → storeEarning   = subtotal - commission
//   • courier → courierEarning = delivery_fee - platform's delivery cut
//                                 (snapshotted on the order as courier_earning)
//
// Rounding rule: money is exact 2-dp `numeric` in the DB. In JS we add in
// integer DIRAM (1 somoni = 100 diram) to avoid float drift, converting back
// only for display. storeEarning is a difference of two already-2dp values, so
// it introduces no new rounding. The only rounding in the system happens once,
// at rate-application time (commission / courier_earning), at order creation.
// =====================================================================

type Money = number | string | null | undefined;

/** Somoni → integer diram (exact). */
export function toDiram(somoni: Money): number {
  return Math.round((Number(somoni) || 0) * 100);
}

/** Integer diram → somoni (2-dp). */
export function fromDiram(diram: number): number {
  return Math.round(diram) / 100;
}

/** Sum a list of somoni amounts without floating-point drift. */
export function sumSomoni(values: Money[]): number {
  return fromDiram(values.reduce<number>((acc, v) => acc + toDiram(v), 0));
}

export interface SettlementOrderFields {
  store_id?: string | null;
  courier_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal?: Money;
  commission?: Money;
  delivery_fee?: Money;
  courier_earning?: Money;
  total?: Money;
}

/** What Colibri owes the store for one order. */
export function storeEarning(o: SettlementOrderFields): number {
  return fromDiram(toDiram(o.subtotal) - toDiram(o.commission));
}

/** Colibri's gross margin on one order: goods commission + delivery margin. */
export function platformRevenue(o: SettlementOrderFields): number {
  const deliveryMargin = toDiram(o.delivery_fee) - toDiram(o.courier_earning);
  return fromDiram(toDiram(o.commission) + deliveryMargin);
}

/**
 * An order is settleable to its store once it is genuinely complete AND the
 * money is in Colibri's hands. COD cash is collected by the courier on
 * Colibri's behalf, so a delivered cash order counts as paid-to-Colibri even
 * though its payment_status stays 'pending' in the current flow. Parcels
 * (store_id null) never settle to a store; cancelled/refunded never settle.
 */
export function isSettleableStoreOrder(o: SettlementOrderFields): boolean {
  if (!o.store_id) return false;
  if (o.status !== 'delivered') return false;
  return o.payment_status === 'paid' || o.payment_method === 'cash';
}

/**
 * SQL mirror of isSettleableStoreOrder — keep the two in lock-step. Reused by
 * settlement API queries so JS and Postgres agree on what counts.
 */
export const SETTLEABLE_ORDER_SQL =
  "store_id is not null and status = 'delivered' and (payment_status = 'paid' or payment_method = 'cash')";

/**
 * A cash order whose `total` the courier collected on Colibri's behalf and
 * therefore owes Colibri. Independent of store settlement — the same order is
 * also owed (in part) to its store. The amount a courier owes is the full
 * order `total` (Colibri takes all the money first, then pays everyone out).
 */
export function isReconcilableCashOrder(o: SettlementOrderFields): boolean {
  return !!o.courier_id && o.payment_method === 'cash' && o.status === 'delivered';
}

// SQL mirror of isReconcilableCashOrder — keep in lock-step.
export const RECONCILABLE_CASH_SQL =
  "courier_id is not null and payment_method = 'cash' and status = 'delivered'";
