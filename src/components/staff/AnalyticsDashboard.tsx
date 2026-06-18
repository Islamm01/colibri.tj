'use client';

import { useEffect, useState } from 'react';

interface Analytics {
  summary: {
    totalOrders: number;
    delivered: number;
    cancelled: number;
    gmv: number;
    platformIncome: number;
    goodsCommission: number;
    deliveryCommission: number;
    courierPayout: number;
    deliveryFees: number;
    aov: number;
    cancelRate: number;
    days: number;
  };
  daily: { date: string; orders: number; revenue: number }[];
  byVertical: Record<string, number>;
  byPayment: Record<string, number>;
  hours: number[];
  couriers: { name: string; count: number }[];
}

const VERTICAL_LABEL: Record<string, string> = { fruits: 'Фрукты', parcel: 'Посылки', pharmacy: 'Аптека', agro: 'Агро' };
const PAYMENT_LABEL: Record<string, string> = { cash: 'Наличные', qr: 'QR', bank_transfer: 'Перевод' };

export function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/staff/admin/analytics?days=${days}`);
        const d = await res.json();
        if (res.ok) setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  return (
    <div className="px-5 lg:px-7 py-5 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-[24px] text-ink-soft leading-tight">Аналитика</h1>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${days === d ? 'bg-fig-600 border-fig-600 text-white' : 'bg-white border-black/[0.08] text-ink-muted'}`}>
              {d} дн
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white/60 rounded-2xl animate-pulse" />)}</div>
      ) : data.summary.totalOrders === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.05] p-10 text-center shadow-soft">
          <div className="text-[40px] mb-2">📊</div>
          <p className="text-[14px] text-ink-soft font-medium">Пока нет данных</p>
          <p className="text-[12px] text-ink-muted mt-1">Здесь появится статистика, как только пойдут заказы.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Revenue summary — the money picture, broken down so it's clear
              what's turnover vs. what Colibri actually earns. */}
          <div className="bg-gradient-to-br from-fig-600 to-fig-800 rounded-2xl p-5 text-white shadow-card">
            <div className="text-[11px] uppercase tracking-[1.4px] text-white/70">
              Оборот за {data.summary.days} дн
            </div>
            <div className="font-serif text-[34px] tabular-nums leading-none mt-1.5">
              {data.summary.gmv.toLocaleString('ru')}{' '}
              <span className="text-[16px] text-white/70">сом</span>
            </div>
            <div className="text-[11px] text-white/55 mt-1">
              сумма всех доставленных заказов
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/15">
              <div>
                <div className="text-[11px] text-white/70">Доход платформы</div>
                <div className="text-[19px] font-semibold tabular-nums mt-0.5">
                  {data.summary.platformIncome.toLocaleString('ru')} <span className="text-[11px] font-normal text-white/60">сом</span>
                </div>
                <div className="text-[10px] text-white/50 mt-0.5">комиссия с заказов и доставки</div>
              </div>
              <div>
                <div className="text-[11px] text-white/70">Курьерам</div>
                <div className="text-[19px] font-semibold tabular-nums mt-0.5">
                  {data.summary.courierPayout.toLocaleString('ru')} <span className="text-[11px] font-normal text-white/60">сом</span>
                </div>
                <div className="text-[10px] text-white/50 mt-0.5">выплаты за доставку</div>
              </div>
            </div>
          </div>

          {/* Operational KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Kpi label="Заказов" value={data.summary.totalOrders} />
            <Kpi label="Доставлено" value={data.summary.delivered} tone="green" />
            <Kpi label="Средний чек" value={`${data.summary.aov.toLocaleString('ru')} сом`} />
            <Kpi label="Отмены" value={`${data.summary.cancelRate}%`} hint={`${data.summary.cancelled} зак.`} />
          </div>

          {/* Daily orders bar chart */}
          <Card title="Заказы по дням">
            <BarChart values={data.daily.map((d) => d.orders)} labels={data.daily.map((d) => d.date.slice(5))} />
          </Card>

          {/* Daily turnover */}
          <Card title="Оборот по дням (сом)">
            <BarChart values={data.daily.map((d) => d.revenue)} labels={data.daily.map((d) => d.date.slice(5))} tone="gold" />
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Busy hours */}
            <Card title="Часы активности">
              <BarChart values={data.hours} labels={data.hours.map((_, h) => (h % 6 === 0 ? `${h}` : ''))} dense />
            </Card>

            {/* Vertical + payment splits */}
            <Card title="Распределение">
              <Split title="По вертикали" data={data.byVertical} labelMap={VERTICAL_LABEL} />
              <div className="h-3" />
              <Split title="По оплате" data={data.byPayment} labelMap={PAYMENT_LABEL} />
            </Card>
          </div>

          {/* Courier leaderboard */}
          {data.couriers.length > 0 && (
            <Card title="Лучшие курьеры">
              <div className="space-y-2">
                {data.couriers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[13px] text-ink-soft">{i + 1}. {c.name}</span>
                    <span className="text-[13px] font-medium text-fig-700">{c.count} доставок</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string | number; tone?: 'green' | 'fig'; hint?: string }) {
  const color = tone === 'green' ? 'text-green-700' : tone === 'fig' ? 'text-fig-800' : 'text-ink-soft';
  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] p-4 shadow-soft">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={`text-[20px] font-medium mt-1 tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-ink-faint mt-0.5">{hint}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] p-4 shadow-soft">
      <div className="text-[11px] font-medium text-ink-subtle tracking-[1.2px] uppercase mb-3">{title}</div>
      {children}
    </div>
  );
}

function BarChart({ values, labels, tone, dense }: { values: number[]; labels: string[]; tone?: 'gold'; dense?: boolean }) {
  const max = Math.max(1, ...values);
  const barColor = tone === 'gold' ? 'bg-gold-400' : 'bg-fig-500';
  return (
    <div>
      <div className="flex items-end gap-[2px] h-28">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end group relative" title={`${labels[i] || i}: ${v}`}>
            <div className={`${barColor} rounded-t-sm transition-all`} style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? '2px' : '0' }} />
          </div>
        ))}
      </div>
      {!dense && (
        <div className="flex justify-between mt-1.5 text-[9px] text-ink-faint">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

function Split({ title, data, labelMap }: { title: string; data: Record<string, number>; labelMap: Record<string, string> }) {
  const total = Object.values(data).reduce((s, n) => s + n, 0) || 1;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="text-[10px] text-ink-faint mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {entries.map(([k, n]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[11px] text-ink-soft w-16 shrink-0">{labelMap[k] ?? k}</span>
            <div className="flex-1 h-2 rounded-full bg-cream-100 overflow-hidden">
              <div className="h-full bg-fig-400 rounded-full" style={{ width: `${(n / total) * 100}%` }} />
            </div>
            <span className="text-[11px] text-ink-muted w-7 text-right">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
