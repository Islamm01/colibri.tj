'use client';

import { useEffect, useState } from 'react';

interface Store {
  id: string;
  name: string;
  vertical: string;
  category: string | null;
  is_active: boolean;
  is_paused: boolean;
  commission_rate: number;
  min_order_amount: number | null;
  ownerName: string;
  ownerPhone: string;
}

export function StoreManager() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/admin/stores');
      const data = await res.json();
      setStores(data.stores ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function patch(storeId: string, fields: Record<string, unknown>) {
    setSavingId(storeId);
    try {
      const res = await fetch('/api/staff/admin/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, ...fields }),
      });
      if (res.ok) {
        setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, ...fields } : s)));
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="px-5 lg:px-7 py-6"><div className="space-y-2 max-w-2xl">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/60 rounded-xl animate-pulse" />)}</div></div>;
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Магазины</h1>
      <p className="text-[13px] text-ink-muted mb-5">{stores.length} магазинов на платформе.</p>

      {stores.length === 0 ? (
        <div className="text-center py-10 text-ink-muted text-[14px]">
          Магазинов пока нет. Одобрите заявку партнёра, чтобы создать первый.
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink-soft">{s.name}</div>
                  <div className="text-[12px] text-ink-muted">{s.ownerName} · {s.ownerPhone}</div>
                </div>
                <span className={`shrink-0 text-[10px] font-medium px-2 py-1 rounded-full ${
                  !s.is_active ? 'bg-red-50 text-red-700' : s.is_paused ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'
                }`}>
                  {!s.is_active ? 'Отключён' : s.is_paused ? 'На паузе' : 'Активен'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-ink-subtle">Комиссия %</span>
                  <input
                    type="number"
                    defaultValue={Math.round(s.commission_rate * 100)}
                    onBlur={(e) => {
                      const pct = Number(e.target.value);
                      if (pct >= 0 && pct <= 100) patch(s.id, { commission_rate: pct / 100 });
                    }}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-[13px] tabular-nums focus:outline-none focus:border-fig-600/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-ink-subtle">Мин. заказ (сом)</span>
                  <input
                    type="number"
                    defaultValue={s.min_order_amount ?? 0}
                    onBlur={(e) => patch(s.id, { min_order_amount: Number(e.target.value) })}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-[13px] tabular-nums focus:outline-none focus:border-fig-600/40"
                  />
                </label>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => patch(s.id, { is_paused: !s.is_paused })}
                  disabled={savingId === s.id}
                  className="flex-1 py-2 rounded-lg border border-black/[0.12] text-ink-soft text-[12.5px] font-medium disabled:opacity-60"
                >
                  {s.is_paused ? 'Снять с паузы' : 'Поставить на паузу'}
                </button>
                <button
                  onClick={() => patch(s.id, { is_active: !s.is_active })}
                  disabled={savingId === s.id}
                  className={`flex-1 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-60 ${
                    s.is_active ? 'border border-red-200 text-red-600' : 'btn-fig text-white'
                  }`}
                >
                  {s.is_active ? 'Отключить' : 'Включить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
