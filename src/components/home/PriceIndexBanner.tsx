'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

export function PriceIndexBanner() {
  const t = useTranslations('prices');
  const locale = useLocale();

  return (
    <section className="px-5 pt-5">
      <Link
        href={`/${locale}/prices`}
        className="block rounded-2xl surface p-4 card-lift relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-gold-300 tracking-[1.6px] uppercase mb-1">
              {t('eyebrow')}
            </div>
            <div className="font-serif text-[16px] text-cream-100 leading-tight">{t('title')}</div>
          </div>

          {/* Minimal price chart — reads instantly as "prices" */}
          <div className="shrink-0">
            <PriceSparkline />
          </div>
        </div>
      </Link>
    </section>
  );
}

function PriceSparkline() {
  // A clean upward price trend: lime line + soft area fill + end dot
  const pts = [2, 14, 8, 20, 13, 26, 18, 32];
  const W = 104, H = 46, max = 36;
  const step = W / (pts.length - 1);
  const coords = pts.map((p, i) => [i * step, H - (p / max) * H]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const [ex, ey] = coords[coords.length - 1];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="overflow-visible">
      <defs>
        <linearGradient id="pspark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8F169" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#C8F169" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* faint baseline grid */}
      <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(200,241,105,0.12)" strokeWidth="1" />
      <path d={area} fill="url(#pspark)" />
      <path d={line} stroke="#C8F169" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ex} cy={ey} r="3.4" fill="#C8F169" />
      <circle cx={ex} cy={ey} r="6" fill="#C8F169" fillOpacity="0.25" />
    </svg>
  );
}
