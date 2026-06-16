'use client';

import { useTranslations, useLocale } from 'next-intl';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { PILLAR_IMAGES } from '@/lib/category-visuals';

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
        <CategoryTile
          href={`/${locale}/marketplace`}
          title={tv('fruits.title')}
          subtitle={tv('fruits.subtitle')}
          stat={tv('fruits.stat1', { count: fruitStoreCount })}
          image={PILLAR_IMAGES.fruits}
          glyph={<BasketIcon />}
        />
        <CategoryTile
          href={`/${locale}/parcel`}
          title={tv('parcel.title')}
          subtitle={tv('parcel.subtitle')}
          stat={tv('parcel.stat1')}
          image={PILLAR_IMAGES.parcel}
          glyph={<ParcelIcon />}
        />
      </div>

      {/* Gifts by Colibri — the premium pillar, full-width cinematic */}
      <div className="mt-3 stagger">
        <CategoryTile
          href={`/${locale}/gifts`}
          eyebrow={tv('gifts.brand')}
          title={tv('gifts.title')}
          subtitle={tv('gifts.subtitle')}
          image={PILLAR_IMAGES.gifts}
          glyph={<GiftIcon />}
          accent="gold"
          ratioClass="aspect-[16/9]"
        />
      </div>
    </section>
  );
}

function BasketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9h14l-1.2 9.3a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5 9Z" />
      <path d="M3 9h18M9 9 12 3l3 6" />
    </svg>
  );
}

function ParcelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 4 9 7 12 7Zm0 0s3-5 5.5-3S15 7 12 7Z" />
    </svg>
  );
}
