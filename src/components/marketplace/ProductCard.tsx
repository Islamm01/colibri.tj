'use client';

import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/cart-store';
import { formatSom } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useShallow } from 'zustand/react/shallow';
import { SmartImage } from '@/components/images/SmartImage';

interface Props {
  product: Product;
  locale: string;
}

export function ProductCard({ product, locale }: Props) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('currency');
  const tp = useTranslations('product');

  const { addItem, setQuantity, item, hasHydrated } = useCart(
    useShallow((s) => ({
      addItem: s.addItem,
      setQuantity: s.setQuantity,
      item: s.items.find((i) => i.product_id === product.id),
      hasHydrated: s._hasHydrated,
    })),
  );

  const name = locale === 'ru' ? product.name_ru : product.name_tj;
  const image = product.images?.[0]?.url;
  const unitLabel =
    product.unit === 'kg' ? t('perKg')
    : product.unit === 'piece' ? t('perPiece')
    : product.unit === 'pack' ? t('perPack')
    : t('perKg');

  const inCart = hasHydrated && !!item;
  const quantity = item?.quantity ?? 0;

  return (
    <div className="group relative surface rounded-[1.5rem] overflow-hidden card-lift flex flex-col">
      {/* Large immersive image on dark */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-forest-700 to-forest-900">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.05]">
          <SmartImage
            src={image}
            alt={name}
            seed={name}
            fallbackWidth={400}
            fallbackHeight={400}
            sizes="(max-width: 448px) 50vw, 200px"
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 flex-1 flex flex-col">
        <h3 className="text-[14px] font-semibold text-cream-100 leading-tight line-clamp-1">{name}</h3>
        <p className="text-[11px] text-cream-100/45 mt-0.5 line-clamp-1">{unitLabel}</p>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[16px] font-bold text-cream-100">{formatSom(product.price)}</span>
            <span className="text-[11px] text-cream-100/50">{tc('som')}</span>
          </div>

          {!inCart ? (
            <button
              onClick={() =>
                addItem({
                  id: product.id,
                  store_id: product.store_id,
                  price: product.price,
                  unit: product.unit,
                  images: product.images,
                  name,
                })
              }
              className="w-10 h-10 rounded-full btn-gold flex items-center justify-center active:scale-90 transition-transform shrink-0"
              aria-label={t('addToCart')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1 surface-soft rounded-full px-1 py-1 animate-pop shrink-0">
              <button
                onClick={() => setQuantity(product.id, quantity - (product.unit === 'kg' ? 0.5 : 1))}
                className="w-7 h-7 flex items-center justify-center text-cream-100 active:scale-90 transition-transform"
                aria-label="Decrease"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
              </button>
              <span className="text-cream-100 text-[12px] font-semibold tabular-nums min-w-[28px] text-center">
                {quantity}{(product.unit === 'kg' || product.unit === 'gram') && 'кг'}
              </span>
              <button
                onClick={() => setQuantity(product.id, quantity + (product.unit === 'kg' ? 0.5 : 1))}
                className="w-7 h-7 flex items-center justify-center text-gold-300 active:scale-90 transition-transform"
                aria-label="Increase"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
