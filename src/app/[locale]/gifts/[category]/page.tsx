import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getGiftProducts } from '@/lib/gifts';
import { isGiftType, giftTagLabel } from '@/lib/categories';
import { giftCategoryImage } from '@/lib/category-visuals';
import type { Product } from '@/lib/types';
import { GiftCard } from '@/components/gifts/GiftCard';

export const revalidate = 60;

export default async function GiftCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('gifts');
  const tc = await getTranslations('common');

  // The [category] segment is one of the three gift TYPE categories.
  if (!isGiftType(category)) notFound();

  let list: Product[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServer();
      list = await getGiftProducts(supabase, { type: category });
    } catch {
      list = [];
    }
  }

  const title = giftTagLabel(category, locale);

  return (
    <div className="pb-6">
      {/* Cinematic category header — curated brand asset */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-forest-700 to-forest-900">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${giftCategoryImage(category)})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/92 via-forest-900/35 to-forest-900/25 pointer-events-none" />
        <Link
          href={`/${locale}/gifts`}
          className="absolute top-3 left-3 w-10 h-10 rounded-full glass flex items-center justify-center"
          aria-label={tc('back')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[11px] font-medium tracking-[2px] uppercase text-gold-300/90">{t('brand')}</p>
          <h1 className="font-serif text-[26px] text-cream-100 leading-tight mt-0.5 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
            {title}
          </h1>
        </div>
      </div>

      <div className="px-5 pt-5">
        {list.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 stagger">
            {list.map((p) => (
              <GiftCard key={p.id} product={p} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center px-8">
            <div className="w-14 h-14 mx-auto rounded-full bg-gold-300/15 flex items-center justify-center text-gold-300 mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-cream-100">{t('empty')}</p>
            <p className="text-[12px] text-cream-100/50 mt-1">{t('emptyHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
