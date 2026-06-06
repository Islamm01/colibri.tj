'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface PriceRow {
  id: string;
  item_key: string;
  name_tj: string;
  name_ru: string;
  unit: string;
  category: string;
  emoji: string | null;
  image_url: string | null;
  farm_low: number | null;
  farm_high: number | null;
  bazaar_low: number | null;
  bazaar_high: number | null;
  trend: 'up' | 'down' | 'flat';
  region: string | null;
}

interface HistoryData {
  days: string[];
  overall: (number | null)[];
  items: Record<string, (number | null)[]>;
}

const CATEGORY_ORDER = ['fruit', 'dried', 'nut', 'vegetable'];

export function PriceIndexClient({ locale }: { locale: string }) {
  const t = useTranslations('prices');
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 30>(30);
  const [history, setHistory] = useState<HistoryData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/price-index');
        const data = await res.json();
        setPrices(data.prices ?? []);
        setDate(data.date ?? null);
      } catch {
        setPrices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/price-index/history?days=${range}`);
        const data = await res.json();
        setHistory(data);
      } catch {
        setHistory(null);
      }
    })();
  }, [range]);

  if (loading) {
    return (
      <div className="mt-6 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 surface-soft rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <div className="mt-10 text-center px-6">
        <div className="text-[40px] mb-2">📋</div>
        <p className="text-[14px] text-cream-100/55">{t('empty')}</p>
      </div>
    );
  }

  const dateLabel = date
    ? new Date(date).toLocaleDateString(locale === 'tj' ? 'tg' : 'ru', {
        day: 'numeric',
        month: 'long',
      })
    : '';

  // Group by category
  const byCat = CATEGORY_ORDER.map((cat) => ({
    cat,
    rows: prices.filter((p) => p.category === cat),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mt-5">
      {/* Trading-style market history chart */}
      <MarketChart
        history={history}
        range={range}
        onRange={setRange}
        somLabel={t('som')}
        title={t('indexTitle')}
        hint={t('indexHint')}
        label7={t('range7')}
        label30={t('range30')}
        emptyLabel={t('noHistory')}
        locale={locale}
      />

      {/* Date + legend */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] text-cream-100/55">
          {t('updated')} · <span className="text-gold-300 font-medium">{dateLabel}</span>
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center px-4 mb-1.5">
        <div className="flex-1" />
        <div className="w-[88px] text-right text-[9.5px] font-medium text-cream-100/45 tracking-wide uppercase">
          {t('farmGate')}
        </div>
        <div className="w-[88px] text-right text-[9.5px] font-medium text-cream-100/45 tracking-wide uppercase">
          {t('bazaar')}
        </div>
      </div>

      <div className="space-y-4">
        {byCat.map((group) => (
          <div key={group.cat}>
            <div className="text-[10px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-1.5 px-1">
              {t(`category.${group.cat}`)}
            </div>
            <div className="surface rounded-2xl border border-gold-300/10 shadow-soft overflow-hidden">
              {group.rows.map((row, i) => (
                <PriceRowItem
                  key={row.id}
                  row={row}
                  locale={locale}
                  somLabel={t('som')}
                  last={i === group.rows.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* The "honest spread" explainer — the strategic message */}
      <div className="mt-5 bg-gradient-to-br from-fig-600 to-fig-800 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full surface/15 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="font-serif text-[16px] mb-1">{t('spreadTitle')}</div>
            <p className="text-[12.5px] text-white/80 leading-relaxed">{t('spreadBody')}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-cream-100/35 mt-5 px-6 leading-relaxed">
        {t('disclaimer')}
      </p>
    </div>
  );
}

function PriceRowItem({
  row,
  locale,
  somLabel,
  last,
}: {
  row: PriceRow;
  locale: string;
  somLabel: string;
  last: boolean;
}) {
  const name = locale === 'tj' ? row.name_tj : row.name_ru;

  const fmtRange = (lo: number | null, hi: number | null) => {
    if (lo == null && hi == null) return '—';
    if (lo != null && hi != null) return `${lo}–${hi}`;
    return `${lo ?? hi}`;
  };

  return (
    <div className={`flex items-center px-4 py-3 ${last ? '' : 'border-b border-gold-300/10'}`}>
      {/* Item */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {row.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.image_url}
            alt=""
            loading="lazy"
            className="w-9 h-9 rounded-lg object-cover border border-gold-300/15 shrink-0"
          />
        ) : (
          <span className="w-9 h-9 flex items-center justify-center text-[20px] leading-none shrink-0">
            {row.emoji ?? '•'}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-medium text-cream-100 truncate">{name}</span>
            <TrendBadge trend={row.trend} />
          </div>
          {row.region ? (
            <div className="text-[10px] text-cream-100/35 truncate">{row.region}</div>
          ) : null}
        </div>
      </div>

      {/* Farm-gate price */}
      <div className="w-[88px] text-right">
        <span className="text-[13px] text-cream-100/55 tabular-nums">
          {fmtRange(row.farm_low, row.farm_high)}
        </span>
      </div>

      {/* Bazaar price */}
      <div className="w-[88px] text-right">
        <span className="text-[13.5px] font-medium text-cream-100 tabular-nums">
          {fmtRange(row.bazaar_low, row.bazaar_high)}
        </span>
      </div>
    </div>
  );
}

function MarketChart({
  history,
  range,
  onRange,
  somLabel,
  title,
  hint,
  label7,
  label30,
  emptyLabel,
  locale,
}: {
  history: HistoryData | null;
  range: 7 | 30;
  onRange: (r: 7 | 30) => void;
  somLabel: string;
  title: string;
  hint: string;
  label7: string;
  label30: string;
  emptyLabel: string;
  locale: string;
}) {
  // Collect non-null points keyed by their day index for proper x-spacing
  const days = history?.days ?? [];
  const overall = history?.overall ?? [];
  const points = overall
    .map((v, i) => ({ i, v }))
    .filter((p): p is { i: number; v: number } => p.v != null);

  const W = 300;
  const H = 76;
  const padY = 10;

  const hasChart = points.length >= 2;
  const first = points[0]?.v ?? null;
  const lastPt = points[points.length - 1];
  const current = lastPt?.v ?? null;
  const changePct =
    first != null && current != null && first !== 0
      ? ((current - first) / first) * 100
      : null;
  const up = changePct != null && changePct > 0.05;
  const down = changePct != null && changePct < -0.05;
  const lineColor = up ? '#FF4F5E' : down ? '#16a34a' : '#C8F169';

  let linePath = '';
  let areaPath = '';
  if (hasChart) {
    const denomX = Math.max(1, days.length - 1);
    const values = points.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const xy = points.map((p) => {
      const x = (p.i / denomX) * W;
      const y = padY + (1 - (p.v - min) / span) * (H - padY * 2);
      return { x, y };
    });
    linePath = xy.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    areaPath = `${linePath} L${xy[xy.length - 1].x.toFixed(1)},${H} L${xy[0].x.toFixed(1)},${H} Z`;
  }

  const lastDayLabel = lastPt
    ? new Date(days[lastPt.i]).toLocaleDateString(locale === 'tj' ? 'tg' : 'ru', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <div className="surface rounded-2xl border border-gold-300/10 shadow-soft p-4 mb-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[13px] font-medium text-cream-100">{title}</div>
          <div className="text-[10px] text-cream-100/45">{hint}</div>
        </div>
        <div className="flex gap-1 surface-soft rounded-lg p-0.5">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                range === r ? 'bg-gold-300 text-forest-900' : 'text-cream-100/55 hover:text-cream-100'
              }`}
            >
              {r === 7 ? label7 : label30}
            </button>
          ))}
        </div>
      </div>

      {hasChart ? (
        <>
          <div className="flex items-end justify-between mb-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-[24px] text-cream-100 tabular-nums leading-none">
                {current}
              </span>
              <span className="text-[11px] text-cream-100/45">{somLabel}</span>
            </div>
            {changePct != null && (
              <span
                className={`inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums ${
                  up ? 'text-red-500' : down ? 'text-green-600' : 'text-cream-100/55'
                }`}
              >
                {up ? '▲' : down ? '▼' : '–'} {Math.abs(changePct).toFixed(1)}%
              </span>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[76px]">
            <defs>
              <linearGradient id="mc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#mc-fill)" />
            <path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="text-right text-[10px] text-cream-100/35 mt-1">{lastDayLabel}</div>
        </>
      ) : (
        <div className="py-6 text-center text-[12px] text-cream-100/45">{emptyLabel}</div>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'flat') return null;
  const up = trend === 'up';
  return (
    <span
      className={`inline-flex items-center shrink-0 ${
        up ? 'text-red-500' : 'text-green-600'
      }`}
      title={up ? 'выше' : 'ниже'}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {up ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
      </svg>
    </span>
  );
}
