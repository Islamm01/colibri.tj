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
              className="block surface rounded-2xl overflow-hidden card-lift"
            >
              <div className="relative h-36 bg-forest-700 overflow-hidden">
                <SmartImage
                  src={store.cover_image_url}
                  alt={store.name}
                  seed={store.name}
                  showGlyph={false}
                  fallbackWidth={800}
                  fallbackHeight={450}
                  sizes="(max-width: 448px) 100vw, 400px"
                  priority
                />
                <div className="absolute top-3 left-3">
                  {open ? (
                    <span className="text-[10px] font-medium text-forest-900 bg-gold-300 px-2 py-1 rounded-md tracking-wider">
                      {t('openUntil', { time: closesAt ?? '' })}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-cream-100 glass-forest px-2 py-1 rounded-md tracking-wider">
                      {t('closed')}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-[17px] text-cream-100 leading-tight">{store.name}</h2>
                  {store.rating && (
                    <div className="flex items-center gap-1 text-[12px] text-cream-100 shrink-0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-gold-300">
                        <path d="m12 2 3 7 7 .7-5.5 4.7 1.7 7L12 17.6 5.8 21.4l1.7-7L2 9.7 9 9l3-7Z" />
                      </svg>
                      <span className="font-medium">{store.rating.toFixed(1)}</span>
                      <span className="text-cream-100/45">({store.rating_count})</span>
                    </div>
                  )}
                </div>
                {description && (
                  <p className="text-[12px] text-cream-100/50 mt-1.5 leading-snug line-clamp-2">
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
