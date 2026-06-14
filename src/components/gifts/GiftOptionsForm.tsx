'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/cart-store';
import type { Product } from '@/lib/types';

// Collects order-level gift options on the detail page, then adds the set to
// the cart and stashes the options in the cart store for checkout to pick up.
export function GiftOptionsForm({ product, locale }: { product: Product; locale: string }) {
  const t = useTranslations('gifts');
  const addItem = useCart((s) => s.addItem);
  const setGiftOptions = useCart((s) => s.setGiftOptions);
  const openDrawer = useCart((s) => s.openDrawer);

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [added, setAdded] = useState(false);

  const name = locale === 'ru' ? product.name_ru : product.name_tj;
  const today = new Date().toISOString().slice(0, 10);

  function addToCart() {
    addItem({
      id: product.id,
      store_id: product.store_id,
      price: product.price,
      unit: product.unit,
      images: product.images,
      name,
      is_wholesale: product.is_wholesale,
      min_quantity: product.min_quantity,
    });
    setGiftOptions({
      recipient_name: recipient.trim(),
      gift_message: message.trim(),
      scheduled_date: date || null,
    });
    setAdded(true);
    openDrawer();
  }

  return (
    <div className="space-y-3.5">
      <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase">
        {t('giftOptions')}
      </h2>

      <div>
        <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('recipientLabel')}</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={t('recipientPlaceholder')}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all"
        />
      </div>

      <div>
        <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('messageLabel')}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('messagePlaceholder')}
          rows={3}
          maxLength={300}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all resize-none"
        />
      </div>

      <div>
        <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('dateLabel')}</label>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all"
        />
        <p className="text-[11px] text-cream-100/40 mt-1">{t('dateHint')}</p>
      </div>

      <button
        onClick={addToCart}
        className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        {added ? t('added') : t('addToCart')}
      </button>
    </div>
  );
}
