import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { formatSom } from '@/lib/format';
import type { Product } from '@/lib/types';
import { SmartImage } from '@/components/images/SmartImage';

// Seasonal "Gifts by Colibri" feature on the homepage — one curated set.
export async function GiftFeatureStrip({
  product,
  locale,
}: {
  product: Product | null;
  locale: string;
}) {
  if (!product) return null;
  const tv = await getTranslations('verticals');
  const name = locale === 'ru' ? product.name_ru : product.name_tj;

  return (
    <section className="px-5 pt-6">
      <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.6px] uppercase mb-3">
        {tv('gifts.brand')}
      </h2>
      <Link
        href={`/${locale}/gifts/${product.category ?? 'gift_box'}/${product.id}`}
        className="group relative block surface rounded-[1.5rem] overflow-hidden card-lift border border-gold-300/[0.14]"
      >
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-forest-700 to-forest-900">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.05]">
            <SmartImage
              src={product.images?.[0]?.url}
              alt={name}
              seed={name}
              fallbackWidth={800}
              fallbackHeight={400}
              sizes="(max-width: 448px) 100vw, 400px"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/20 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-serif text-[18px] text-cream-100 leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
              {name}
            </h3>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[15px] font-bold text-gold-300">{formatSom(product.price)}</span>
              <span className="text-[11px] text-cream-100/70">сом</span>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
