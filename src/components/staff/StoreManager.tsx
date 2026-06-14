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

const VERTICAL_LABEL: Record<string, string> = {
  fruits: 'Фрукты',
  parcel: 'Посылки',
  gifts: 'Подарки',
};

export function StoreManager() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingGift, setCreatingGift] = useState(false);

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
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Магазины</h1>
          <p className="text-[13px] text-ink-muted">{stores.length} магазинов на платформе.</p>
        </div>
        <button
          onClick={() => setCreatingGift(true)}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-fig text-white text-[12px] font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 4 9 7 12 7Zm0 0s3-5 5.5-3S15 7 12 7Z" />
          </svg>
          Подарочный магазин
        </button>
      </div>

      {stores.length === 0 ? (
        <div className="text-center py-10 text-ink-muted text-[14px]">
          Магазинов пока нет. Одобрите заявку партнёра или создайте подарочный магазин.
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[15px] font-medium text-ink-soft">{s.name}</div>
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-fig-50 text-fig-700">
                      {VERTICAL_LABEL[s.vertical] ?? s.vertical}
                    </span>
                  </div>
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

      {creatingGift && (
        <CreateGiftStoreDrawer
          onClose={() => setCreatingGift(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function CreateGiftStoreDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [commission, setCommission] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ phone: string; password: string } | null>(null);

  async function create() {
    setError(null);
    if (name.trim().length < 2) {
      setError('Укажите название магазина');
      return;
    }
    if (ownerPhone.replace(/\D/g, '').length < 9) {
      setError('Укажите телефон владельца');
      return;
    }
    setSaving(true);
    try {
      const pct = Number(commission);
      const res = await fetch('/api/staff/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          owner_name: ownerName || undefined,
          owner_phone: ownerPhone,
          commission_rate: pct >= 0 && pct <= 100 ? pct / 100 : 0.1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Не удалось создать магазин');
        return;
      }
      setCreds(data.credentials);
      onCreated();
    } catch {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade-in" aria-label="Close" />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <h2 className="font-serif text-[18px] text-ink-soft">Подарочный магазин</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {creds ? (
            <div className="px-4 py-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="text-[11px] font-medium text-green-800 uppercase tracking-wide mb-1.5">
                Магазин создан — данные для входа
              </div>
              <div className="text-[13px] text-ink-soft font-mono">
                <div>Логин: {creds.phone}</div>
                <div>Пароль: {creds.password}</div>
              </div>
              <div className="text-[10.5px] text-green-700 mt-1.5">
                Передайте владельцу. Магазин на паузе, пока не добавит наборы. Витрина «Подарки» появится автоматически.
              </div>
            </div>
          ) : (
            <>
              <p className="text-[12.5px] text-ink-muted leading-snug">
                Создаёт магазин в направлении «Подарки» и аккаунт владельца для управления каталогом наборов.
              </p>
              <Field label="Название (бренд набора)">
                <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="напр. Gifts by Colibri" />
              </Field>
              <Field label="Имя владельца">
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="form-input" placeholder="напр. Менеджер подарков" />
              </Field>
              <Field label="Телефон владельца (логин)">
                <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="form-input" placeholder="+992 90 000 00 00" />
              </Field>
              <Field label="Комиссия %">
                <input type="number" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} className="form-input" />
              </Field>
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{error}</div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-black/[0.06] safe-bottom">
          {creds ? (
            <button onClick={onClose} className="w-full py-3.5 rounded-xl btn-fig text-white font-medium text-[14px]">
              Готово
            </button>
          ) : (
            <button
              onClick={create}
              disabled={saving}
              className="w-full py-3.5 rounded-xl btn-fig text-white font-medium text-[14px] disabled:opacity-60"
            >
              {saving ? 'Создаём...' : 'Создать магазин'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
