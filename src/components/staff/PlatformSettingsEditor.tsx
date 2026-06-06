'use client';

import { useEffect, useState } from 'react';

interface Settings {
  parcel_base_fare: number;
  parcel_base_km: number;
  parcel_per_km: number;
  parcel_heavy_surcharge: number;
  parcel_max_km: number;
  fruit_delivery_fee: number;
  fruit_free_delivery_over: number | null;
  default_commission_rate: number;
  support_telegram: string;
}

export function PlatformSettingsEditor() {
  const [s, setS] = useState<Settings | null>(null);
  const [dispatchMode, setDispatchMode] = useState<'broadcast' | 'sequential'>('broadcast');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/staff/admin/settings');
        const data = await res.json();
        setS(data.settings);
        setDispatchMode(data.dispatchMode ?? 'broadcast');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/staff/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, dispatchMode }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) return <div className="px-5 lg:px-7 py-6 text-ink-muted text-[13px]">Загрузка...</div>;

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Настройки платформы</h1>
      <p className="text-[13px] text-ink-muted mb-5">Цены и правила можно менять без перезапуска.</p>

      <div className="space-y-4">
        {/* Dispatch */}
        <Card title="Назначение курьеров">
          <div className="flex gap-2">
            {(['broadcast', 'sequential'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setDispatchMode(m); setSaved(false); }}
                className={`flex-1 py-2.5 rounded-lg text-[12.5px] font-medium border transition-all ${
                  dispatchMode === m ? 'bg-fig-50 border-fig-600/40 text-fig-700' : 'bg-white border-black/[0.08] text-ink-muted'
                }`}
              >
                {m === 'broadcast' ? 'Всем сразу' : 'По очереди'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint mt-2">
            «Всем сразу» — заказ видят все курьеры онлайн, кто первый принял. «По очереди» — ближайшему, затем следующему.
          </p>
        </Card>

        {/* Parcel pricing */}
        <Card title="Цены на посылки (сом)">
          <div className="grid grid-cols-2 gap-3">
            <Num label="База (первые км)" value={s.parcel_base_fare} onChange={(v) => set('parcel_base_fare', v)} />
            <Num label="Бесплатные км" value={s.parcel_base_km} onChange={(v) => set('parcel_base_km', v)} />
            <Num label="За каждый км" value={s.parcel_per_km} onChange={(v) => set('parcel_per_km', v)} />
            <Num label="Доплата 5–15 кг" value={s.parcel_heavy_surcharge} onChange={(v) => set('parcel_heavy_surcharge', v)} />
            <Num label="Макс. расстояние км" value={s.parcel_max_km} onChange={(v) => set('parcel_max_km', v)} />
          </div>
        </Card>

        {/* Fruit delivery */}
        <Card title="Доставка фруктов (сом)">
          <div className="grid grid-cols-2 gap-3">
            <Num label="Стоимость доставки" value={s.fruit_delivery_fee} onChange={(v) => set('fruit_delivery_fee', v)} />
            <Num label="Бесплатно от" value={s.fruit_free_delivery_over ?? 0} onChange={(v) => set('fruit_free_delivery_over', v || null)} />
          </div>
        </Card>

        {/* Commission + support */}
        <Card title="Прочее">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Num label="Комиссия по умолч. %" value={Math.round(s.default_commission_rate * 100)} onChange={(v) => set('default_commission_rate', v / 100)} />
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-ink-subtle">Telegram поддержки (без @)</span>
            <input
              type="text"
              value={s.support_telegram ?? ''}
              onChange={(e) => set('support_telegram', e.target.value as Settings['support_telegram'])}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-black/[0.1] text-[13.5px] focus:outline-none focus:border-fig-600/40"
            />
          </label>
        </Card>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full btn-fig text-white py-3 rounded-xl font-medium text-[14px] disabled:opacity-60"
      >
        {saving ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
      <div className="text-[11px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-3">{title}</div>
      {children}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-ink-subtle leading-tight block">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-black/[0.1] text-[13.5px] tabular-nums focus:outline-none focus:border-fig-600/40"
      />
    </label>
  );
}
