'use client';

import { useEffect, useState } from 'react';

interface App {
  id: string;
  full_name: string;
  phone: string;
  vehicle: string;
  has_smartphone: boolean;
  district: string | null;
  about: string | null;
  status: 'new' | 'contacted' | 'approved' | 'rejected';
  created_at: string;
}

const TABS = [
  { key: 'new', label: 'Новые' },
  { key: 'contacted', label: 'В работе' },
  { key: 'approved', label: 'Одобрены' },
  { key: 'rejected', label: 'Отклонены' },
] as const;

const VEHICLE_LABEL: Record<string, string> = { moto: '🛵 Мото', bike: '🚲 Велосипед', car: '🚗 Авто', foot: '🚶 Пешком' };

export function CourierApplications() {
  const [tab, setTab] = useState<'new' | 'contacted' | 'approved' | 'rejected'>('new');
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creds, setCreds] = useState<Record<string, { phone: string; password: string }>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courier-applications?status=${tab}`);
      const data = await res.json();
      if (res.ok) setApps(data.applications ?? []);
      else setError('Не удалось загрузить заявки');
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  async function act(app: App, action: 'approve' | 'contacted' | 'rejected') {
    setBusyId(app.id);
    setError(null);
    try {
      const res = await fetch('/api/courier-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id, action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'approve' && data.credentials) {
          setCreds((p) => ({ ...p, [app.id]: data.credentials }));
          setTimeout(load, 2500);
        } else {
          load();
        }
      } else {
        setError(data.detail || 'Не удалось выполнить');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-3xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Заявки курьеров</h1>
      <p className="text-[13px] text-ink-muted mb-4">Одобрение создаёт аккаунт курьера — передайте логин и пароль.</p>

      <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar">
        {TABS.map((s) => (
          <button key={s.key} onClick={() => setTab(s.key)}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap border transition-all ${tab === s.key ? 'bg-fig-600 border-fig-600 text-white' : 'bg-white border-black/[0.08] text-ink-muted'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse" />)}</div>
      ) : apps.length === 0 ? (
        <div className="text-center py-12 text-ink-muted text-[14px]">Заявок нет</div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink-soft">{app.full_name}</div>
                  <div className="text-[12px] text-ink-muted mt-0.5">{app.phone}</div>
                </div>
                <span className="shrink-0 text-[11px] font-medium px-2 py-1 rounded-full bg-fig-50 text-fig-700">
                  {VEHICLE_LABEL[app.vehicle] ?? app.vehicle}
                </span>
              </div>

              {(app.district || app.about) && (
                <div className="mt-2.5 space-y-1 text-[12.5px] text-ink-soft">
                  {app.district && <div><span className="text-ink-faint">Район: </span>{app.district}</div>}
                  {app.about && <div className="text-ink-muted leading-snug">{app.about}</div>}
                </div>
              )}

              {creds[app.id] && (
                <div className="mt-3 px-3.5 py-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="text-[11px] font-medium text-green-800 uppercase tracking-wide mb-1.5">Аккаунт создан</div>
                  <div className="text-[13px] text-ink-soft font-mono">
                    <div>Логин: {creds[app.id].phone}</div>
                    <div>Пароль: {creds[app.id].password}</div>
                  </div>
                  <div className="text-[10.5px] text-green-700 mt-1.5">Передайте курьеру для входа в /staff/login</div>
                </div>
              )}

              {app.status !== 'approved' && app.status !== 'rejected' && !creds[app.id] && (
                <div className="flex gap-2 mt-3.5">
                  <button onClick={() => act(app, 'approve')} disabled={busyId === app.id}
                    className="flex-1 py-2.5 rounded-lg btn-fig text-white text-[13px] font-medium disabled:opacity-60">
                    {busyId === app.id ? '...' : 'Одобрить и создать аккаунт'}
                  </button>
                  {app.status === 'new' && (
                    <button onClick={() => act(app, 'contacted')} disabled={busyId === app.id}
                      className="px-3.5 py-2.5 rounded-lg border border-black/[0.12] text-ink-soft text-[13px] font-medium disabled:opacity-60">
                      В работу
                    </button>
                  )}
                  <button onClick={() => act(app, 'rejected')} disabled={busyId === app.id}
                    className="px-3.5 py-2.5 rounded-lg border border-red-200 text-red-600 text-[13px] font-medium disabled:opacity-60">
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
