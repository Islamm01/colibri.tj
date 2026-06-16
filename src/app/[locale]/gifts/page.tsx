import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getGiftProducts } from '@/lib/gifts';
import { GIFT_TYPES, giftTagLabel } from '@/lib/categories';
import { giftCategoryImage } from '@/lib/category-visuals';
import type { Product } from '@/lib/types';
import { GiftCard } from '@/components/gifts/GiftCard';
import { CategoryTile } from '@/components/ui/CategoryTile';

export const revalidate = 60;

export default async function GiftsHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('gifts');

  // One query powers both the combined catalog feed and the category covers.
  let products: Product[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServer();
      products = await getGiftProducts(supabase);
    } catch {
      products = [];
    }
  }

  return (
    <div className="pb-6">
      {/* Premium brand hero */}
      <section className="relative emerald-hero glow-halo overflow-hidden px-5 pt-8 pb-9">
        <p className="relative text-[11px] font-medium tracking-[2.2px] uppercase text-gold-300">
          {t('brand')}
        </p>
        <h1 className="relative font-serif text-[30px] leading-[1.08] text-cream-100 mt-2 max-w-[290px]">
          {t('heroTitle')}
        </h1>
        <p className="relative text-[13px] text-cream-100/65 mt-2.5 max-w-[300px] leading-snug">
          {t('heroSubtitle')}
        </p>
      </section>

      {/* Three entry categories — quick filters, premium imagery */}
      <section className="px-5 pt-6">
        <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
          {t('categories')}
        </h2>
        <div className="grid grid-cols-3 gap-2.5 stagger">
          {GIFT_TYPES.map((g) => (
            <CategoryTile
              key={g.key}
              href={`/${locale}/gifts/${g.key}`}
              title={giftTagLabel(g.key, locale)}
              image={giftCategoryImage(g.key)}
              glyph={<GiftTypeIcon type={g.key} />}
              ratioClass="aspect-[3/4]"
            />
          ))}
        </div>
      </section>

      {/* Combined catalog — every gift set, no extra navigation */}
      <section className="px-5 pt-8">
        <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
          {t('allGifts')}
        </h2>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 stagger">
            {products.map((p) => (
              <GiftCard key={p.id} product={p} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-gold-300/15 flex items-center justify-center text-gold-300 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-cream-100">{t('empty')}</p>
            <p className="text-[12px] text-cream-100/50 mt-1">{t('emptyHint')}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function GiftTypeIcon({ type }: { type: string }) {
  if (type === 'honey') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3h8M9 3v3a3 3 0 0 0 6 0V3M7 21h10l-1-9a4 4 0 0 0-8 0l-1 9Z" />
      </svg>
    );
  }
  if (type === 'gift_box') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 4 9 7 12 7Zm0 0s3-5 5.5-3S15 7 12 7Z" />
      </svg>
    );
  }
  // fruit_basket
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 10h14l-1.4 9.3a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 10ZM3 10h18M9 10l3-6 3 6" />
    </svg>
  );
}
