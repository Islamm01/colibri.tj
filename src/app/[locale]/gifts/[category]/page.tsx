import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getGiftProducts } from '@/lib/gifts';
import { isGiftType, isGiftOccasion, giftTagLabel } from '@/lib/categories';
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

  // The [category] segment is either a gift TYPE or an OCCASION tag.
  const asType = isGiftType(category);
  const asOccasion = isGiftOccasion(category);
  if (!asType && !asOccasion) notFound();

  let list: Product[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServer();
      list = await getGiftProducts(
        supabase,
        asType ? { type: category } : { occasion: category },
      );
    } catch {
      list = [];
    }
  }

  return (
    <div className="pb-6">
      <header className="px-5 pt-5 pb-3 animate-fade-up">
        <Link
          href={`/${locale}/gifts`}
          className="inline-flex items-center gap-1.5 text-[12px] text-cream-100/55 hover:text-gold-300 transition-colors mb-2.5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {tc('back')}
        </Link>
        <p className="text-[11px] font-medium tracking-[2px] uppercase text-gold-300/90">{t('brand')}</p>
        <h1 className="font-serif text-[24px] text-cream-100 leading-tight mt-1">
          {giftTagLabel(category, locale)}
        </h1>
      </header>

      {list.length > 0 ? (
        <div className="px-5 grid grid-cols-2 gap-3 stagger">
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
  );
}
