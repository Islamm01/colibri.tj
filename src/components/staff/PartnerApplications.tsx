'use client';

import { useEffect, useState } from 'react';

interface Application {
  id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  address: string | null;
  vertical: string | null;
  category: string | null;
  description: string | null;
  status: 'new' | 'contacted' | 'approved' | 'rejected';
  created_at: string;
}

interface ApprovedCreds {
  phone: string;
  password: string;
}

const STATUS_TABS = [
  { key: 'new', label: 'Новые' },
  { key: 'contacted', label: 'В работе' },
  { key: 'approved', label: 'Одобрены' },
  { key: 'rejected', label: 'Отклонены' },
] as const;

const VERTICAL_LABEL: Record<string, string> = {
  fruits: 'Фрукты и орехи',
  pharmacy: 'Аптека',
  agro: 'Агро',
  other: 'Другое',
};

export function PartnerApplications() {
  const [tab, setTab] = useState<'new' | 'contacted' | 'approved' | 'rejected'>('new');
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approved, setApproved] = useState<Record<string, ApprovedCreds>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/admin/applications?status=${tab}`);
      const data = await res.json();
      if (res.ok) setApps(data.applications ?? []);
      else setError('Не удалось загрузить заявки');
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function approve(app: Application) {
    setBusyId(app.id);
    setError(null);
    try {
      const res = await fetch('/api/staff/admin/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setApproved((prev) => ({ ...prev, [app.id]: data.credentials }));
        // refresh after a moment so the card moves to "approved"
        setTimeout(load, 2500);
      } else {
        setError(data.detail || 'Не удалось одобрить заявку');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(app: Application, status: 'contacted' | 'rejected') {
    setBusyId(app.id);
    try {
      await fetch('/api/staff/admin/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id, status }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-3xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Заявки партнёров</h1>
      <p className="text-[13px] text-ink-muted mb-4">
        Одобрение создаёт магазин и аккаунт для входа — передайте логин и пароль партнёру.
      </p>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar">
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-all border ${
              tab === s.key
                ? 'bg-fig-600 border-fig-600 text-white'
                : 'bg-white border-black/[0.08] text-ink-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-12 text-ink-muted text-[14px]">Заявок нет</div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <div key={app.id} className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink-soft">{app.business_name}</div>
                  <div className="text-[12px] text-ink-muted mt-0.5">
                    {app.contact_name} · {app.phone}
                  </div>
                </div>
                {app.vertical && (
                  <span className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full bg-fig-50 text-fig-700">
                    {VERTICAL_LABEL[app.vertical] ?? app.vertical}
                  </span>
                )}
              </div>

              {(app.category || app.address || app.description) && (
                <div className="mt-2.5 space-y-1 text-[12.5px] text-ink-soft">
                  {app.category && (
                    <div>
                      <span className="text-ink-faint">Категория: </span>
                      {app.category}
                    </div>
                  )}
                  {app.address && (
                    <div>
                      <span className="text-ink-faint">Адрес: </span>
                      {app.address}
                    </div>
                  )}
                  {app.description && <div className="text-ink-muted leading-snug">{app.description}</div>}
                </div>
              )}

              {/* Credentials shown after approval */}
              {approved[app.id] && (
                <div className="mt-3 px-3.5 py-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="text-[11px] font-medium text-green-800 uppercase tracking-wide mb-1.5">
                    Магазин создан — данные для входа
                  </div>
                  <div className="text-[13px] text-ink-soft font-mono">
                    <div>Логин: {approved[app.id].phone}</div>
                    <div>Пароль: {approved[app.id].password}</div>
                  </div>
                  <div className="text-[10.5px] text-green-700 mt-1.5">
                    Передайте партнёру. Магазин на паузе, пока не добавит товары.
                  </div>
                </div>
              )}

              {/* Actions (hidden once approved/rejected) */}
              {app.status !== 'approved' && app.status !== 'rejected' && !approved[app.id] && (
                <div className="flex gap-2 mt-3.5">
                  <button
                    onClick={() => approve(app)}
                    disabled={busyId === app.id}
                    className="flex-1 py-2.5 rounded-lg btn-fig text-white text-[13px] font-medium disabled:opacity-60"
                  >
                    {busyId === app.id ? '...' : 'Одобрить и создать магазин'}
                  </button>
                  {app.status === 'new' && (
                    <button
                      onClick={() => setStatus(app, 'contacted')}
                      disabled={busyId === app.id}
                      className="px-3.5 py-2.5 rounded-lg border border-black/[0.12] text-ink-soft text-[13px] font-medium disabled:opacity-60"
                    >
                      В работу
                    </button>
                  )}
                  <button
                    onClick={() => setStatus(app, 'rejected')}
                    disabled={busyId === app.id}
                    className="px-3.5 py-2.5 rounded-lg border border-red-200 text-red-600 text-[13px] font-medium disabled:opacity-60"
                  >
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
