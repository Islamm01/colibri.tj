'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

interface Props {
  fruitStoreCount: number;
}

export function ActiveVerticals({ fruitStoreCount }: Props) {
  const t = useTranslations('home');
  const tv = useTranslations('verticals');
  const locale = useLocale();

  return (
    <section className="px-5 pt-6">
      <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
        {t('availableNow')}
      </h2>

      <div className="grid grid-cols-2 gap-3 stagger">
        <VerticalCard
          href={`/${locale}/marketplace`}
          title={tv('fruits.title')}
          subtitle={tv('fruits.subtitle')}
          stat={tv('fruits.stat1', { count: fruitStoreCount })}
          icon={<BasketIcon />}
        />
        <VerticalCard
          href={`/${locale}/parcel`}
          title={tv('parcel.title')}
          subtitle={tv('parcel.subtitle')}
          stat={tv('parcel.stat1')}
          icon={<ParcelIcon />}
        />
      </div>

      {/* Gifts by Colibri — the premium pillar, full-width */}
      <Link
        href={`/${locale}/gifts`}
        className="group relative block mt-3 surface rounded-[1.5rem] p-5 card-lift overflow-hidden border border-gold-300/[0.18] bg-gradient-to-br from-forest-700/70 to-forest-900/70"
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gold-300/[0.08] blur-xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-gold-300/20 to-gold-300/[0.04] border border-gold-300/20 flex items-center justify-center text-gold-300 transition-transform group-hover:scale-110">
            <GiftIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-[1.6px] uppercase text-gold-300/80">{tv('gifts.brand')}</p>
            <h3 className="font-serif text-[18px] text-cream-100 leading-tight mt-0.5">{tv('gifts.title')}</h3>
            <p className="text-[11.5px] text-cream-100/55 mt-0.5 leading-snug line-clamp-1">{tv('gifts.subtitle')}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300 shrink-0">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </div>
      </Link>
    </section>
  );
}

function VerticalCard({
  href, title, subtitle, stat, icon,
}: {
  href: string; title: string; subtitle: string; stat: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block surface rounded-[1.5rem] p-4 card-lift">
      <div className="w-full aspect-[5/3] rounded-2xl bg-gradient-to-br from-forest-600 to-forest-800 flex items-center justify-center mb-3 relative overflow-hidden border border-gold-300/[0.08]">
        <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-gold-300/[0.06]" />
        <div className="relative text-gold-300 transition-transform group-hover:scale-110">{icon}</div>
      </div>
      <h3 className="font-serif text-[16px] text-cream-100 leading-tight">{title}</h3>
      <p className="text-[11px] text-cream-100/45 mt-0.5 leading-snug line-clamp-2">{subtitle}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gold-300" />
        <span className="text-[10px] text-cream-100/55">{stat}</span>
      </div>
    </Link>
  );
}

function BasketIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h30l-2.5 19a3 3 0 0 1-3 2.6H14.5a3 3 0 0 1-3-2.6L9 18Z" />
      <path d="M6 18h36M17 18 21 8M31 18 27 8" />
      <circle cx="19" cy="28" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="29" cy="28" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="24" cy="33" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ParcelIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M42 32V16a2 2 0 0 0-1-1.74l-15-8.5a2 2 0 0 0-2 0l-15 8.5A2 2 0 0 0 8 16v16a2 2 0 0 0 1 1.74l15 8.5a2 2 0 0 0 2 0l15-8.5A2 2 0 0 0 42 32Z" />
      <path d="m8.5 15 15.5 9 15.5-9M24 41V24" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 4 9 7 12 7Zm0 0s3-5 5.5-3S15 7 12 7Z" />
    </svg>
  );
}
