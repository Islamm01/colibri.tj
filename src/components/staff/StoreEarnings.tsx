'use client';

import { useEffect, useState } from 'react';
import { formatSom } from '@/lib/format';

interface Data {
  outstanding: { amount: number; order_count: number };
  lifetime: { paid_out: number; commission_earned: number; payout_count: number; last_payout_at: string | null };
  recent: Array<{
    public_code: string;
    created_at: string;
    delivered_at: string | null;
    subtotal: number;
    commission: number;
    store_earning: number;
    settled: boolean;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    order_count: number;
    status: string;
    reference: string | null;
    created_at: string;
    paid_at: string | null;
  }>;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function StoreEarnings() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/staff/store/earnings', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="px-5 lg:px-7 py-5 max-w-2xl space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse" />)}
      </div>
    );
  }
  if (!data) {
    return <div className="px-5 lg:px-7 py-6 text-ink-muted text-[13px]">Не удалось загрузить доходы.</div>;
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Мои доходы</h1>
      <p className="text-[13px] text-ink-muted mb-5">
        Colibri принимает оплату от клиентов и переводит вам вашу долю (сумма заказа минус комиссия) раз в неделю.
      </p>

      {/* Outstanding balance */}
      <div className="bg-gradient-to-br from-fig-600 to-fig-800 rounded-2xl p-5 text-white shadow-card mb-4">
        <div className="text-[11px] uppercase tracking-[1.4px] text-white/70">Colibri должен вам</div>
        <div className="font-serif text-[34px] tabular-nums leading-none mt-1.5">
          {formatSom(data.outstanding.amount)} <span className="text-[16px] text-white/70">сом</span>
        </div>
        <div className="text-[12px] text-white/60 mt-1.5">
          {data.outstanding.order_count} доставленных заказ(ов) ждут выплаты
        </div>
      </div>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 shadow-soft">
          <div className="text-[11px] text-ink-muted">Выплачено всего</div>
          <div className="text-[20px] font-medium text-ink-soft tabular-nums mt-1">{formatSom(data.lifetime.paid_out)} сом</div>
          <div className="text-[10px] text-ink-faint mt-0.5">{data.lifetime.payout_count} выплат</div>
        </div>
        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 shadow-soft">
          <div className="text-[11px] text-ink-muted">Комиссия Colibri</div>
          <div className="text-[20px] font-medium text-ink-soft tabular-nums mt-1">{formatSom(data.lifetime.commission_earned)} сом</div>
          <div className="text-[10px] text-ink-faint mt-0.5">удержано с заказов</div>
        </div>
      </div>

      {/* Payout history */}
      <h2 className="text-[12px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-2.5">История выплат</h2>
      {data.payouts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.05] p-5 text-center text-[13px] text-ink-muted shadow-soft mb-5">
          Выплат пока не было.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft overflow-hidden mb-5">
          {data.payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-black/[0.04] first:border-t-0">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink-soft tabular-nums">{formatSom(p.amount)} сом</div>
                <div className="text-[11px] text-ink-muted">
                  {fmtDate(p.paid_at ?? p.created_at)} · {p.order_count} заказ(ов){p.reference ? ` · ${p.reference}` : ''}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                p.status === 'paid' ? 'bg-green-50 text-green-700' : p.status === 'void' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
              }`}>
                {p.status === 'paid' ? 'выплачено' : p.status === 'void' ? 'отменено' : 'в ожидании'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent orders with earning — transparent math */}
      <h2 className="text-[12px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-2.5">Последние заказы</h2>
      {data.recent.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.05] p-5 text-center text-[13px] text-ink-muted shadow-soft">
          Пока нет доставленных заказов.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 bg-black/[0.02] text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
            <div>Заказ</div>
            <div className="text-right">Сумма − комиссия</div>
            <div className="text-right w-[80px]">Вам</div>
          </div>
          {data.recent.map((o) => (
            <div key={o.public_code} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 items-center border-t border-black/[0.04]">
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-ink-subtle">{o.public_code}</div>
                <div className="text-[10px] text-ink-faint flex items-center gap-1.5">
                  {fmtDate(o.delivered_at ?? o.created_at)}
                  <span className={`px-1.5 py-px rounded-full ${o.settled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {o.settled ? 'выплачено' : 'ждёт'}
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-ink-muted tabular-nums">
                {formatSom(o.subtotal)} − {formatSom(o.commission)}
              </div>
              <div className="text-right w-[80px] text-[14px] font-semibold text-fig-800 tabular-nums">
                {formatSom(o.store_earning)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
