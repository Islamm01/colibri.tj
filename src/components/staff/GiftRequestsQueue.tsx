'use client';

import { useEffect, useState } from 'react';

interface GiftRequest {
  id: string;
  contact_name: string;
  phone: string;
  budget: number | null;
  occasion: string | null;
  preferences: string | null;
  status: 'new' | 'contacted' | 'fulfilled' | 'rejected';
  created_at: string;
}

const STATUS_TABS = [
  { key: 'new', label: 'Новые' },
  { key: 'contacted', label: 'В работе' },
  { key: 'fulfilled', label: 'Выполнены' },
  { key: 'rejected', label: 'Отклонены' },
] as const;

const OCCASION_LABEL: Record<string, string> = {
  holiday: 'Праздничные',
  corporate: 'Корпоративные',
  custom: 'На заказ',
  other: 'Другое',
};

export function GiftRequestsQueue() {
  const [tab, setTab] = useState<'new' | 'contacted' | 'fulfilled' | 'rejected'>('new');
  const [requests, setRequests] = useState<GiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/gift-requests?status=${tab}`);
      const data = await res.json();
      if (res.ok) setRequests(data.requests ?? []);
      else setError('Не удалось загрузить запросы');
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

  async function setStatus(req: GiftRequest, status: 'contacted' | 'fulfilled' | 'rejected') {
    setBusyId(req.id);
    try {
      await fetch('/api/staff/gift-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: req.id, status }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-3xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Запросы на наборы</h1>
      <p className="text-[13px] text-ink-muted mb-4">
        Индивидуальные подарочные наборы — соберите и согласуйте с клиентом вручную.
      </p>

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
            <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-ink-muted text-[14px]">Запросов нет</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink-soft">{req.contact_name}</div>
                  <a href={`tel:${req.phone}`} className="text-[12px] text-fig-700 mt-0.5 inline-block">
                    {req.phone}
                  </a>
                </div>
                {req.occasion && (
                  <span className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full bg-fig-50 text-fig-700">
                    {OCCASION_LABEL[req.occasion] ?? req.occasion}
                  </span>
                )}
              </div>

              <div className="mt-2.5 space-y-1 text-[12.5px] text-ink-soft">
                {req.budget != null && (
                  <div>
                    <span className="text-ink-faint">Бюджет: </span>
                    {Number(req.budget).toFixed(0)} сом
                  </div>
                )}
                {req.preferences && <div className="text-ink-muted leading-snug">{req.preferences}</div>}
              </div>

              {req.status !== 'fulfilled' && req.status !== 'rejected' && (
                <div className="flex gap-2 mt-3.5">
                  {req.status === 'new' && (
                    <button
                      onClick={() => setStatus(req, 'contacted')}
                      disabled={busyId === req.id}
                      className="px-3.5 py-2.5 rounded-lg border border-black/[0.12] text-ink-soft text-[13px] font-medium disabled:opacity-60"
                    >
                      В работу
                    </button>
                  )}
                  <button
                    onClick={() => setStatus(req, 'fulfilled')}
                    disabled={busyId === req.id}
                    className="flex-1 py-2.5 rounded-lg btn-fig text-white text-[13px] font-medium disabled:opacity-60"
                  >
                    {busyId === req.id ? '...' : 'Выполнено'}
                  </button>
                  <button
                    onClick={() => setStatus(req, 'rejected')}
                    disabled={busyId === req.id}
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
