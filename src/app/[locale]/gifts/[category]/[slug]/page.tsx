import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getGiftProduct } from '@/lib/gifts';
import { giftTagLabel } from '@/lib/categories';
import { formatSom } from '@/lib/format';
import { SmartImage } from '@/components/images/SmartImage';
import { GiftOptionsForm } from '@/components/gifts/GiftOptionsForm';

export const revalidate = 60;

export default async function GiftDetailPage({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  // The [slug] segment is the gift product's id.
  const { locale, category, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('gifts');
  const tc = await getTranslations('common');

  if (!isSupabaseConfigured()) notFound();

  const supabase = await getSupabaseServer();
  const product = await getGiftProduct(supabase, slug);
  if (!product) notFound();

  const name = locale === 'ru' ? product.name_ru : product.name_tj;
  const story = locale === 'ru' ? product.description_ru : product.description_tj;

  return (
    <div className="pb-10">
      {/* Large immersive image */}
      <div className="relative h-72 overflow-hidden bg-gradient-to-br from-forest-700 to-forest-900">
        <SmartImage
          src={product.images?.[0]?.url}
          alt={name}
          seed={name}
          fallbackWidth={800}
          fallbackHeight={700}
          sizes="(max-width: 448px) 100vw, 600px"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/20 to-forest-900/30 pointer-events-none" />
        <Link
          href={`/${locale}/gifts/${category}`}
          className="absolute top-3 left-3 w-10 h-10 rounded-full glass flex items-center justify-center"
          aria-label={tc('back')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="px-5 pt-5">
        {/* Title + price */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {product.category && (
            <span className="text-[10px] font-medium tracking-wide uppercase glass-dark text-gold-300 px-2 py-0.5 rounded-full">
              {giftTagLabel(product.category, locale)}
            </span>
          )}
        </div>
        <h1 className="font-serif text-[26px] text-cream-100 leading-tight">{name}</h1>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-[24px] font-bold text-gold-300">{formatSom(product.price)}</span>
          <span className="text-[13px] text-cream-100/55">сом</span>
        </div>

        {/* Story */}
        {story && (
          <section className="mt-6">
            <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2">
              {t('story')}
            </h2>
            <p className="text-[14px] text-cream-100/75 leading-relaxed whitespace-pre-line">{story}</p>
          </section>
        )}

        {/* Contents */}
        {product.gift_contents && (
          <section className="mt-6">
            <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2">
              {t('contents')}
            </h2>
            <p className="text-[14px] text-cream-100/75 leading-relaxed whitespace-pre-line">
              {product.gift_contents}
            </p>
          </section>
        )}

        {/* Gift options + add to cart */}
        <section className="mt-7">
          <GiftOptionsForm product={product} locale={locale} />
        </section>
      </div>
    </div>
  );
}
