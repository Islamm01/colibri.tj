'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatSom } from '@/lib/format';

interface OverviewRow {
  store_id: string;
  name: string;
  outstanding: number;
  order_count: number;
  last_payout_at: string | null;
  last_payout_amount: number | null;
}
interface Overview {
  stores: OverviewRow[];
  total_outstanding: number;
  stores_with_balance: number;
}

interface OutstandingOrder {
  public_code: string;
  created_at: string;
  delivered_at: string | null;
  subtotal: number;
  commission: number;
  store_earning: number;
  payment_method: string;
}
interface StoreDetail {
  store: { id: string; name: string };
  outstanding: { amount: number; order_count: number; orders: OutstandingOrder[] };
  lifetime: { paid_out: number; commission_earned: number; payout_count: number; last_payout_at: string | null };
}

interface PayoutRow {
  id: string;
  store_id: string;
  amount: number;
  order_count: number;
  status: string;
  reference: string | null;
  note: string | null;
  created_at: string;
  store: { name: string } | { name: string }[] | null;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function storeName(p: PayoutRow): string {
  const s = Array.isArray(p.store) ? p.store[0] : p.store;
  return s?.name ?? '—';
}

export function SettlementDashboard() {
  const [view, setView] = useState<'balances' | 'history'>('balances');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const res = await fetch('/api/staff/admin/settlement', { cache: 'no-store' });
    if (res.ok) setOverview(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      try { await loadOverview(); } finally { setLoading(false); }
    })();
  }, [loadOverview]);

  return (
    <div className="px-5 lg:px-7 py-5 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-[24px] text-ink-soft leading-tight">Выплаты магазинам</h1>
        <div className="flex gap-1.5">
          {(['balances', 'history'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                view === v ? 'bg-fig-600 border-fig-600 text-white' : 'bg-white border-black/[0.08] text-ink-muted'
              }`}
            >
              {v === 'balances' ? 'Балансы' : 'История'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-ink-muted mb-5">
        Colibri собирает все платежи и еженедельно выплачивает магазинам их долю (сумма − комиссия).
      </p>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/60 rounded-2xl animate-pulse" />)}</div>
      ) : view === 'balances' ? (
        <BalancesView overview={overview} onOpen={setSelected} />
      ) : (
        <HistoryView />
      )}

      {selected && (
        <StoreDrawer
          storeId={selected}
          onClose={() => setSelected(null)}
          onPaid={async () => { await loadOverview(); }}
        />
      )}
    </div>
  );
}

function BalancesView({ overview, onOpen }: { overview: Overview | null; onOpen: (id: string) => void }) {
  if (!overview) return null;
  const withBalance = overview.stores.filter((s) => s.outstanding > 0 || s.last_payout_at);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-gradient-to-br from-fig-600 to-fig-800 rounded-2xl p-4 text-white shadow-card">
          <div className="text-[11px] uppercase tracking-[1.2px] text-white/70">К выплате сейчас</div>
          <div className="font-serif text-[26px] tabular-nums mt-1">{formatSom(overview.total_outstanding)} <span className="text-[13px] text-white/70">сом</span></div>
        </div>
        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 shadow-soft">
          <div className="text-[11px] uppercase tracking-[1.2px] text-ink-subtle">Магазинов с долгом</div>
          <div className="text-[26px] font-medium text-ink-soft tabular-nums mt-1">{overview.stores_with_balance}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 bg-black/[0.02] text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
          <div>Магазин</div>
          <div className="text-right w-[110px]">К выплате</div>
          <div className="text-right w-[110px]">Последняя</div>
        </div>
        {withBalance.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-ink-muted">Пока нет данных для выплат.</div>
        )}
        {withBalance.map((s) => (
          <button
            key={s.store_id}
            onClick={() => onOpen(s.store_id)}
            className="w-full grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center border-t border-black/[0.04] hover:bg-fig-50/40 transition-colors text-left"
          >
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-ink-soft truncate">{s.name}</div>
              <div className="text-[11px] text-ink-muted">{s.order_count} заказ(ов) к выплате</div>
            </div>
            <div className="text-right w-[110px]">
              <div className={`text-[15px] font-semibold tabular-nums ${s.outstanding > 0 ? 'text-fig-800' : 'text-ink-faint'}`}>
                {formatSom(s.outstanding)}
              </div>
              <div className="text-[10px] text-ink-faint">сом</div>
            </div>
            <div className="text-right w-[110px]">
              <div className="text-[11px] text-ink-muted">{s.last_payout_at ? fmtDate(s.last_payout_at) : 'никогда'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StoreDrawer({ storeId, onClose, onPaid }: { storeId: string; onClose: () => void; onPaid: () => Promise<void> }) {
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/staff/admin/settlement/${storeId}`, { cache: 'no-store' });
    if (res.ok) setDetail(await res.json());
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  async function recordPayout() {
    if (!detail || detail.outstanding.amount <= 0) return;
    if (!confirm(`Записать выплату ${formatSom(detail.outstanding.amount)} сом магазину «${detail.store.name}»?\n\nЭто отметит ${detail.outstanding.order_count} заказ(ов) как оплаченные. Действие нельзя отменить.`)) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/admin/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, reference, note }),
      });
      const data = await res.json();
      if (res.ok && data.settled) {
        setReference('');
        setNote('');
        await load();
        await onPaid();
        setMessage('Выплата записана ✓');
      } else if (res.ok && !data.settled) {
        setMessage('Нет неоплаченных заказов для выплаты.');
        await load();
      } else {
        setMessage(data.detail || 'Не удалось записать выплату.');
      }
    } catch {
      setMessage('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade-in" aria-label="Закрыть" />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] text-ink-subtle uppercase tracking-wide">Расчёт с магазином</div>
            <div className="text-[16px] font-medium text-ink-soft truncate">{detail?.store.name ?? '…'}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5" aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {!detail ? (
          <div className="flex-1 flex items-center justify-center"><span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="bg-gradient-to-br from-fig-600 to-fig-800 rounded-2xl p-4 text-white">
                <div className="text-[11px] uppercase tracking-[1.2px] text-white/70">К выплате</div>
                <div className="font-serif text-[30px] tabular-nums mt-1">{formatSom(detail.outstanding.amount)} <span className="text-[15px] text-white/70">сом</span></div>
                <div className="text-[11px] text-white/60 mt-0.5">{detail.outstanding.order_count} заказ(ов) · сумма − комиссия</div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-black/[0.02] rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wide text-ink-subtle">Выплачено всего</div>
                  <div className="text-[16px] font-medium text-ink-soft tabular-nums mt-0.5">{formatSom(detail.lifetime.paid_out)} сом</div>
                </div>
                <div className="bg-black/[0.02] rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wide text-ink-subtle">Комиссия с магазина</div>
                  <div className="text-[16px] font-medium text-ink-soft tabular-nums mt-0.5">{formatSom(detail.lifetime.commission_earned)} сом</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-2">Заказы к выплате</div>
                {detail.outstanding.orders.length === 0 ? (
                  <div className="text-[13px] text-ink-muted px-1 py-3">Нет неоплаченных заказов.</div>
                ) : (
                  <div className="space-y-1.5">
                    {detail.outstanding.orders.map((o) => (
                      <div key={o.public_code} className="flex items-center justify-between gap-2 bg-black/[0.015] rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] text-ink-subtle">{o.public_code}</div>
                          <div className="text-[10px] text-ink-faint">{fmtDate(o.delivered_at ?? o.created_at)}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="text-[10px] text-ink-faint tabular-nums">
                            {formatSom(o.subtotal)} − {formatSom(o.commission)}
                          </div>
                          <div className="text-[13px] font-semibold text-fig-800 tabular-nums w-[64px]">{formatSom(o.store_earning)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Record payout */}
            <div className="px-5 py-4 border-t border-black/[0.06] safe-bottom space-y-2.5">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Реквизит / референс перевода (необязательно)"
                className="w-full px-3 py-2 rounded-lg border border-black/[0.1] text-[13px] focus:outline-none focus:border-fig-600/40"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Примечание (необязательно)"
                className="w-full px-3 py-2 rounded-lg border border-black/[0.1] text-[13px] focus:outline-none focus:border-fig-600/40"
              />
              {message && <div className="text-[12px] text-ink-muted text-center">{message}</div>}
              <button
                onClick={recordPayout}
                disabled={submitting || detail.outstanding.amount <= 0}
                className="w-full py-3 rounded-xl btn-fig text-white font-medium text-[14px] disabled:opacity-50"
              >
                {submitting
                  ? 'Запись...'
                  : detail.outstanding.amount > 0
                  ? `Записать выплату ${formatSom(detail.outstanding.amount)} сом`
                  : 'Нет суммы к выплате'}
              </button>
              <p className="text-[10px] text-ink-faint text-center leading-snug">
                Запись отметит заказы как оплаченные. Деньги переводятся отдельно (вне системы).
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryView() {
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/staff/admin/settlement/payouts', { cache: 'no-store' });
      if (res.ok) setPayouts((await res.json()).payouts ?? []);
      else setPayouts([]);
    })();
  }, []);

  if (!payouts) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-white/60 rounded-2xl animate-pulse" />)}</div>;
  if (payouts.length === 0) return <div className="bg-white rounded-2xl border border-black/[0.05] p-8 text-center text-[13px] text-ink-muted shadow-soft">Выплат пока не было.</div>;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft overflow-hidden">
      {payouts.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-black/[0.04] first:border-t-0">
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-ink-soft truncate">{storeName(p)}</div>
            <div className="text-[11px] text-ink-muted">
              {fmtDate(p.created_at)} · {p.order_count} заказ(ов){p.reference ? ` · ${p.reference}` : ''}
            </div>
            {p.note && <div className="text-[11px] text-ink-faint truncate">{p.note}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[15px] font-semibold text-fig-800 tabular-nums">{formatSom(p.amount)} <span className="text-[10px] text-ink-muted font-normal">сом</span></div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.status === 'paid' ? 'bg-green-50 text-green-700' : p.status === 'void' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              {p.status === 'paid' ? 'выплачено' : p.status === 'void' ? 'отменено' : 'в ожидании'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
