import { notFound } from 'next/navigation';
import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { isStoreOpenNow } from '@/lib/format';
import type { Store, Product } from '@/lib/types';
import { categoryOrder, isKnownCategory } from '@/lib/categories';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { StoreReviews } from '@/components/marketplace/StoreReviews';
import { SmartImage } from '@/components/images/SmartImage';

export const revalidate = 60;

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string; storeSlug: string }>;
}) {
  const { locale, storeSlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketplace');
  const tc = await getTranslations('common');

  if (!isSupabaseConfigured()) notFound();

  const supabase = await getSupabaseServer();

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) notFound();
  const s = store as unknown as Store;

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', s.id)
    .eq('is_available', true)
    .order('sort_order');

  const list = (products ?? []) as unknown as Product[];
  const { open, closesAt } = isStoreOpenNow(s);
  const description = locale === 'ru' ? s.description_ru : s.description_tj;

  // Group products by category
  const grouped = list.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? 'other';
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      {/* Immersive cover with emerald cinematic overlay */}
      <div className="relative h-64 overflow-hidden bg-gradient-to-br from-fig-600 to-fig-800">
        <SmartImage
          src={s.cover_image_url}
          alt={s.name}
          seed={s.name}
          showGlyph={false}
          fallbackWidth={800}
          fallbackHeight={600}
          sizes="(max-width: 448px) 100vw, 600px"
          priority
        />
        {/* emerald gradient scrim for depth + legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-fig-900/85 via-fig-900/25 to-fig-900/10 pointer-events-none" />

        <Link
          href={`/${locale}/marketplace`}
          className="absolute top-3 left-3 w-10 h-10 rounded-full glass flex items-center justify-center"
          aria-label={tc('back')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>

        {/* Floating editorial title over image */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-[27px] text-cream-100 leading-[1.1] drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">{s.name}</h1>
              {description && (
                <p className="text-[12px] text-cream-100/80 mt-1.5 leading-snug max-w-[260px] line-clamp-2">{description}</p>
              )}
            </div>
            {s.rating_count && s.rating_count > 0 ? (
              <div className="flex items-center gap-1 text-[13px] shrink-0 glass-dark px-2.5 py-1.5 rounded-full">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-gold-300">
                  <path d="m12 2 3 7 7 .7-5.5 4.7 1.7 7L12 17.6 5.8 21.4l1.7-7L2 9.7 9 9l3-7Z" />
                </svg>
                <span className="font-semibold text-cream-100">{Number(s.rating).toFixed(1)}</span>
                <span className="text-cream-100/70">({s.rating_count})</span>
              </div>
            ) : (
              <div className="text-[11px] text-cream-100 shrink-0 glass-dark px-2.5 py-1.5 rounded-full">
                {t('newStore')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status strip */}
      <div className="px-5 pt-3.5 pb-1">
        <div className="flex items-center gap-3 text-[11.5px] text-cream-100/55">
          {open ? (
            <span className="flex items-center gap-1.5 text-gold-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-300/150" />
              {t('openUntil', { time: closesAt ?? '' })}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-berry-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-berry" />
              {t('closed')}
            </span>
          )}
          <span>· {s.prep_time_minutes} {t('minutesSuffix')}</span>
        </div>
      </div>

      {/* Product groups */}
      <div className="pt-4">
        {Object.entries(grouped)
          .sort(([a], [b]) => categoryOrder(a) - categoryOrder(b))
          .map(([cat, items]) => (
          <section key={cat} className="mb-5">
            <h2 className="px-5 mb-3 text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase">
              {isKnownCategory(cat) ? t(`category.${cat}`) : cat}
            </h2>
            <div className="px-5 grid grid-cols-2 gap-3 stagger">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} locale={locale} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <StoreReviews storeId={s.id} locale={locale} />
    </div>
  );
}
