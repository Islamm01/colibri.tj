import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getGiftProducts } from '@/lib/gifts';
import { giftTagLabel } from '@/lib/categories';
import type { Product } from '@/lib/types';
import { GiftCard } from '@/components/gifts/GiftCard';

export const revalidate = 60;

const OCCASION_TILES = ['holiday', 'corporate', 'custom'] as const;
const TYPE_TILES = ['fruit_basket', 'honey', 'gift_box'] as const;

export default async function GiftsHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('gifts');

  let featured: Product[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServer();
      featured = await getGiftProducts(supabase, { limit: 6 });
    } catch {
      featured = [];
    }
  }

  return (
    <div className="pb-6">
      {/* Premium hero */}
      <section className="relative px-5 pt-7 pb-8 overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-gold-300/[0.07] blur-2xl pointer-events-none" />
        <div className="absolute -left-12 top-20 w-40 h-40 rounded-full bg-fig-600/[0.10] blur-2xl pointer-events-none" />
        <p className="relative text-[11px] font-medium tracking-[2px] uppercase text-gold-300/90">
          {t('brand')}
        </p>
        <h1 className="relative font-serif text-[30px] leading-[1.1] text-cream-100 mt-2 max-w-[280px]">
          {t('heroTitle')}
        </h1>
        <p className="relative text-[13px] text-cream-100/55 mt-2.5 max-w-[300px] leading-snug">
          {t('heroSubtitle')}
        </p>
      </section>

      {/* Shop by occasion */}
      <section className="px-5">
        <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
          {t('shopByOccasion')}
        </h2>
        <div className="grid grid-cols-3 gap-3 stagger">
          {OCCASION_TILES.map((key) => (
            <Link
              key={key}
              href={key === 'custom' ? `/${locale}/gifts/custom` : `/${locale}/gifts/${key}`}
              className="group surface rounded-2xl p-3.5 card-lift flex flex-col items-center text-center gap-2"
            >
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-forest-600 to-forest-800 border border-gold-300/[0.12] flex items-center justify-center text-gold-300 transition-transform group-hover:scale-110">
                <OccasionIcon occasion={key} />
              </span>
              <span className="text-[12px] font-medium text-cream-100 leading-tight">
                {giftTagLabel(key, locale)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Shop by type */}
      <section className="px-5 pt-7">
        <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
          {t('shopByType')}
        </h2>
        <div className="grid grid-cols-3 gap-3 stagger">
          {TYPE_TILES.map((key) => (
            <Link
              key={key}
              href={`/${locale}/gifts/${key}`}
              className="group surface rounded-2xl p-3.5 card-lift flex flex-col items-center text-center gap-2"
            >
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-forest-600 to-forest-800 border border-gold-300/[0.12] flex items-center justify-center text-gold-300 transition-transform group-hover:scale-110">
                <TypeIcon type={key} />
              </span>
              <span className="text-[12px] font-medium text-cream-100 leading-tight">
                {giftTagLabel(key, locale)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured / seasonal sets */}
      {featured.length > 0 && (
        <section className="px-5 pt-8">
          <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
            {t('featured')}
          </h2>
          <div className="grid grid-cols-2 gap-3 stagger">
            {featured.map((p) => (
              <GiftCard key={p.id} product={p} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* Custom set CTA */}
      <section className="px-5 pt-8">
        <Link
          href={`/${locale}/gifts/custom`}
          className="block surface rounded-[1.5rem] p-5 card-lift border border-gold-300/[0.12] bg-gradient-to-br from-forest-700/60 to-forest-900/60"
        >
          <h3 className="font-serif text-[18px] text-cream-100 leading-tight">{t('custom.title')}</h3>
          <p className="text-[12px] text-cream-100/55 mt-1.5 leading-snug">{t('custom.subtitle')}</p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-gold-300">
            {t('custom.cta')}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </Link>
      </section>
    </div>
  );
}

function OccasionIcon({ occasion }: { occasion: string }) {
  if (occasion === 'corporate') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="7" width="16" height="13" rx="1.5" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16" />
      </svg>
    );
  }
  if (occasion === 'custom') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18M3 12h18" /><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" opacity="0.4" />
      </svg>
    );
  }
  // holiday
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 2.4 5 5.6.6-4 4 1 5.4L12 19l-5 3 1-5.4-4-4 5.6-.6L12 2Z" />
    </svg>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'honey') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3h8M9 3v3a3 3 0 0 0 6 0V3M7 21h10l-1-9a4 4 0 0 0-8 0l-1 9Z" />
      </svg>
    );
  }
  if (type === 'gift_box') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 4 9 7 12 7Zm0 0s3-5 5.5-3S15 7 12 7Z" />
      </svg>
    );
  }
  // fruit_basket (default)
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 10h14l-1.4 9.3a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 10ZM3 10h18M9 10l3-6 3 6" />
    </svg>
  );
}
