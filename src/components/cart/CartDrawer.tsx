'use client';

import { useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  useCart,
  selectSubtotal,
  selectDeliveryFee,
  selectTotal,
  selectAmountToFreeDelivery,
  FREE_DELIVERY_THRESHOLD,
} from '@/lib/cart-store';
import { formatSom } from '@/lib/format';
import { SmartImage } from '@/components/images/SmartImage';

export function CartDrawer() {
  const t = useTranslations('cart');
  const tc = useTranslations('currency');
  const locale = useLocale();
  const router = useRouter();

  const items = useCart((s) => s.items);
  const hasHydrated = useCart((s) => s._hasHydrated);
  const isOpen = useCart((s) => s.isOpen);
  const closeDrawer = useCart((s) => s.closeDrawer);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const clear = useCart((s) => s.clear);

  const subtotal = useCart(selectSubtotal);
  const deliveryFee = useCart(selectDeliveryFee);
  const total = useCart(selectTotal);
  const toFree = useCart(selectAmountToFreeDelivery);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const progressPct = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-md">
      {/* Backdrop */}
      <button
        onClick={closeDrawer}
        className="absolute inset-0 bg-black/40 animate-fade-in"
        aria-label="Close cart"
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 inset-x-0 dark-app rounded-t-3xl max-h-[85dvh] flex flex-col shadow-[0_-8px_40px_-8px_rgba(0,0,0,0.5)] border-t border-gold-300/10 animate-slide-up"
        role="dialog"
        aria-label="Cart"
      >
        {/* Drag handle */}
        <div className="pt-2.5 flex justify-center">
          <div className="w-10 h-1 bg-ink-faint/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="font-serif text-[20px] text-cream-100">{t('title')}</h2>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!hasHydrated ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyCart />
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {items.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center gap-3 surface rounded-xl p-2.5"
                >
                  <div className="relative w-14 h-14 rounded-lg bg-forest-700 overflow-hidden shrink-0">
                    <SmartImage
                      src={item.image_url}
                      alt={item.name}
                      seed={item.name}
                      fallbackWidth={56}
                      fallbackHeight={56}
                      sizes="56px"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-cream-100 line-clamp-1">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-cream-100/50 mt-0.5">
                      {formatSom(item.price)} {tc('som')}
                      {(item.unit === 'kg' || item.unit === 'gram') && ' / кг'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 surface-soft rounded-lg px-1 py-0.5 shrink-0">
                    <button
                      onClick={() =>
                        setQuantity(
                          item.product_id,
                          item.quantity - (item.unit === 'kg' ? 0.5 : 1),
                        )
                      }
                      className="w-6 h-6 flex items-center justify-center text-gold-300 active:scale-90 transition-transform"
                      aria-label="Decrease"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <span className="text-[12px] font-medium text-cream-100 min-w-[24px] text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        setQuantity(
                          item.product_id,
                          item.quantity + (item.unit === 'kg' ? 0.5 : 1),
                        )
                      }
                      className="w-6 h-6 flex items-center justify-center text-gold-300 active:scale-90 transition-transform"
                      aria-label="Increase"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="w-7 h-7 flex items-center justify-center text-cream-100/40 hover:text-berry transition-colors shrink-0"
                    aria-label={t('remove')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              ))}

              <button
                onClick={clear}
                className="text-[12px] text-cream-100/45 hover:text-berry transition-colors mt-2"
              >
                {t('clear')}
              </button>
            </div>

            {/* Free delivery progress */}
            <div className="px-5 pt-2">
              {toFree > 0 ? (
                <>
                  <div className="text-[11px] text-cream-100/50 mb-1.5">
                    {t('freeDeliveryProgress', { amount: formatSom(toFree) })}
                  </div>
                  <div className="h-1.5 bg-forest-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-fig-400 to-fig-600 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-[11px] font-medium text-gold-300 bg-green-50 px-3 py-2 rounded-lg">
                  {t('freeDeliveryReached')}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="px-5 py-3 mt-2 space-y-1.5 border-t border-gold-300/10">
              <Row label={t('subtotal')} value={`${formatSom(subtotal)} ${tc('som')}`} />
              <Row
                label={t('delivery')}
                value={
                  deliveryFee === 0
                    ? t('deliveryFree')
                    : `${formatSom(deliveryFee)} ${tc('som')}`
                }
                muted
              />
              <Row
                label={t('total')}
                value={`${formatSom(total)} ${tc('som')}`}
                bold
              />
            </div>

            {/* Checkout button */}
            <div className="px-5 pb-5 safe-bottom">
              <button
                onClick={() => {
                  closeDrawer();
                  router.push(`/${locale}/checkout`);
                }}
                className="w-full btn-berry py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2"
              >
                {t('checkout')}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[13px] ${muted ? 'text-cream-100/50' : 'text-cream-100'}`}>{label}</span>
      <span
        className={`tabular-nums ${
          bold ? 'text-[16px] font-semibold text-cream-100' : 'text-[13px] text-cream-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyCart() {
  const t = useTranslations('cart');
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <div className="w-16 h-16 rounded-full bg-gold-300/15 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300">
          <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7Z" />
          <path d="M9 7V5a3 3 0 1 1 6 0v2" />
        </svg>
      </div>
      <p className="text-[15px] font-medium text-cream-100">{t('empty')}</p>
      <p className="text-[12px] text-cream-100/50 mt-1 text-center">{t('emptyHint')}</p>
    </div>
  );
}
