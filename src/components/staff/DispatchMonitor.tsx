'use client';

import { useEffect, useState } from 'react';

interface OfferState {
  courier: string;
  status: string;
  distanceKm: number | null;
}
interface DispatchOrder {
  id: string;
  publicCode: string;
  status: string;
  vertical: string | null;
  assignedCourier: string | null;
  attempts: number;
  waitingSeconds: number;
  offers: OfferState[];
}

const OFFER_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
  expired: 'bg-cream-100 text-ink-muted',
};
const OFFER_LABEL: Record<string, string> = {
  pending: 'ожидает', accepted: 'принял', rejected: 'отклонил', expired: 'истёк',
};

export function DispatchMonitor() {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/staff/dispatch/state');
      const data = await res.json();
      if (res.ok) setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000); // live refresh
    return () => clearInterval(id);
  }, []);

  return (
    <div className="px-5 lg:px-7 py-5 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-[24px] text-ink-soft leading-tight">Диспетчеризация</h1>
        <span className="flex items-center gap-1.5 text-[11px] text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          live
        </span>
      </div>
      <p className="text-[13px] text-ink-muted mb-5">Заказы в процессе назначения курьера. Обновляется автоматически.</p>

      {loading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.05] p-10 text-center shadow-soft">
          <div className="text-[36px] mb-2">✅</div>
          <p className="text-[14px] text-ink-soft font-medium">Нет заказов в очереди</p>
          <p className="text-[12px] text-ink-muted mt-1">Все заказы назначены или доставляются.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-faint">{o.publicCode}</span>
                  {o.vertical === 'parcel' && <span className="text-[10px] text-fig-700 bg-fig-50 px-1.5 py-0.5 rounded">Посылка</span>}
                </div>
                <span className="text-[11px] text-ink-muted">{formatWait(o.waitingSeconds)}</span>
              </div>

              {o.assignedCourier ? (
                <div className="mt-2 text-[13px] text-green-700 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Назначен: {o.assignedCourier}
                </div>
              ) : (
                <div className="mt-2">
                  <div className="text-[11px] text-ink-muted mb-1.5">
                    Попыток: {o.attempts} · предложено {o.offers.length} курьерам
                  </div>
                  {o.offers.length === 0 ? (
                    <div className="text-[12px] text-amber-700">Нет доступных курьеров — нужен ручной выбор</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {o.offers.map((of, i) => (
                        <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full ${OFFER_TONE[of.status] ?? 'bg-cream-100'}`}>
                          {of.courier} · {OFFER_LABEL[of.status] ?? of.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} сек`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} мин`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
}
