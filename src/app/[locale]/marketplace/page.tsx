import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { isStoreOpenNow } from '@/lib/format';
import type { Store } from '@/lib/types';
import { SmartImage } from '@/components/images/SmartImage';

export const revalidate = 60;

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketplace');

  // Graceful degrade if Supabase isn't configured
  let list: Store[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServer();
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('vertical', 'fruits')
        .eq('is_active', true)
        .order('rating', { ascending: false });
      list = (stores ?? []) as unknown as Store[];
    } catch {
      list = [];
    }
  }

  return (
    <div className="px-5 pt-2 pb-2">
      <div className="mb-5 animate-fade-up">
        <h1 className="font-serif text-[24px] text-cream-100 leading-tight">{t('title')}</h1>
        <p className="text-[13px] text-cream-100/55 mt-1">{t('subtitle')}</p>
      </div>

      <div className="space-y-3 stagger">
        {list.map((store) => {
          const { open, closesAt } = isStoreOpenNow(store);
          const description = locale === 'ru' ? store.description_ru : store.description_tj;

          return (
            <Link
              key={store.id}
              href={`/${locale}/marketplace/${store.slug}`}
              className="group relative block overflow-hidden rounded-[1.5rem] card-lift shadow-card border border-gold-300/10 hover:shadow-card-hover"
            >
              {/* Background cover */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]">
                  <SmartImage
                    src={store.cover_image_url}
                    alt={store.name}
                    seed={store.name}
                    showGlyph={false}
                    fallbackWidth={800}
                    fallbackHeight={500}
                    sizes="(max-width: 448px) 100vw, 400px"
                    priority
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-forest-900/92 via-forest-900/35 to-forest-900/5" />
                <div className="absolute inset-0 bg-gradient-to-tr from-fig-900/25 via-transparent to-transparent" />
              </div>

              {/* Open / closed status */}
              <div className="absolute top-3 left-3 z-10">
                {open ? (
                  <span className="text-[10px] font-medium text-forest-900 bg-gold-300 px-2.5 py-1 rounded-full tracking-wider">
                    {t('openUntil', { time: closesAt ?? '' })}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-cream-100 glass-dark px-2.5 py-1 rounded-full tracking-wider">
                    {t('closed')}
                  </span>
                )}
              </div>

              {/* Rating / new chip */}
              {store.rating ? (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 glass-dark px-2.5 py-1 rounded-full text-[11.5px]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gold-300">
                    <path d="m12 2 3 7 7 .7-5.5 4.7 1.7 7L12 17.6 5.8 21.4l1.7-7L2 9.7 9 9l3-7Z" />
                  </svg>
                  <span className="font-semibold text-cream-100">{store.rating.toFixed(1)}</span>
                  <span className="text-cream-100/55">({store.rating_count})</span>
                </div>
              ) : (
                <div className="absolute top-3 right-3 z-10 glass-dark px-2.5 py-1 rounded-full text-[10.5px] text-cream-100">
                  {t('newStore')}
                </div>
              )}

              {/* Content over scrim */}
              <div className="relative aspect-[16/10] flex flex-col justify-end p-4">
                <h2 className="font-serif text-[19px] text-cream-100 leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                  {store.name}
                </h2>
                {description && (
                  <p className="text-[12px] text-cream-100/75 mt-1 leading-snug line-clamp-1 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                    {description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
        {list.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-gold-300/15 flex items-center justify-center text-gold-300 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <p className="text-[13px] text-cream-100/55">
              {locale === 'ru' ? 'Магазины скоро появятся' : 'Фурӯшгоҳҳо ба зудӣ пайдо мешаванд'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
