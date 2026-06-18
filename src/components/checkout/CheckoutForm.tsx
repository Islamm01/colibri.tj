'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  useCart,
  selectSubtotal,
  DELIVERY_BASE_FEE,
} from '@/lib/cart-store';
import { formatSom } from '@/lib/format';
import { setActiveOrderCode } from '@/lib/active-order';
import type { PaymentMethod } from '@/lib/types';
import { ContactSection, type ContactValue, type RecognizedAddress } from './ContactSection';
import { AddressPicker, type AddressValue } from './AddressPicker';
import { PaymentPicker } from './PaymentPicker';

type InitialSession = { name: string; phone: string } | null;

export function CheckoutForm({ initialSession }: { initialSession: InitialSession }) {
  const t = useTranslations('checkout');
  const tc = useTranslations('currency');
  const locale = useLocale();
  const router = useRouter();

  const items = useCart((s) => s.items);
  const storeId = useCart((s) => s.storeId);
  const hasHydrated = useCart((s) => s._hasHydrated);
  const subtotal = useCart(selectSubtotal);
  const clearCart = useCart((s) => s.clear);
  const giftOptions = useCart((s) => s.giftOptions);

  const [deliveryFee, setDeliveryFee] = useState<number>(DELIVERY_BASE_FEE);
  const deliveryFeeController = useRef<AbortController | null>(null);

  // Generate idempotency key once when this mount begins.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const [contact, setContact] = useState<ContactValue>({
    phone: initialSession?.phone ?? '',
    name: initialSession?.name ?? '',
  });
  const [address, setAddress] = useState<AddressValue>({
    formatted_address: '',
    details: '',
    lat: null,
    lng: null,
  });
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  const [recognizedName, setRecognizedName] = useState<string | null>(
    initialSession?.name ?? null,
  );
  const [savedAddresses, setSavedAddresses] = useState<RecognizedAddress[]>([]);

  const [fieldErrors, setFieldErrors] = useState<{
    phone?: string;
    name?: string;
    coords?: string;
    text?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Once an order is successfully placed and we've navigated, this ref
  // prevents the empty-cart useEffect from racing in and bouncing the user
  // to the marketplace before navigation commits.
  const placedOrderRef = useRef(false);

  // Fetch live delivery fee whenever address coords or subtotal change.
  useEffect(() => {
    if (!storeId || address.lat === null || address.lng === null) {
      setDeliveryFee(DELIVERY_BASE_FEE);
      return;
    }
    deliveryFeeController.current?.abort();
    const controller = new AbortController();
    deliveryFeeController.current = controller;
    fetch(
      `/api/delivery-fee?storeId=${storeId}&lat=${address.lat}&lng=${address.lng}&subtotal=${subtotal}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data) => { if (typeof data.fee === 'number') setDeliveryFee(data.fee); })
      .catch(() => { /* keep current estimate on network error */ });
  }, [storeId, address.lat, address.lng, subtotal]);

  const total = subtotal + deliveryFee;

  // Redirect to marketplace if cart is empty — but only AFTER hydration completes,
  // and only when we're not in the middle of submitting AND haven't just placed
  // an order (otherwise the empty-cart-after-clearCart triggers a redirect that
  // overrides our router.push to the tracking page).
  useEffect(() => {
    if (!hasHydrated) return;
    if (placedOrderRef.current) return;
    if (items.length === 0 && !submitting) {
      router.replace(`/${locale}/marketplace`);
    }
  }, [hasHydrated, items.length, submitting, locale, router]);

  function applySavedAddress(saved: RecognizedAddress) {
    setAddress({
      formatted_address: saved.formatted_address,
      details: saved.details ?? '',
      lat: saved.lat,
      lng: saved.lng,
    });
  }

  function validate(): boolean {
    const errors: typeof fieldErrors = {};

    const phoneDigits = contact.phone.replace(/\D/g, '');
    if (phoneDigits.length < 9) errors.phone = t('phoneInvalid');

    if (contact.name.trim().length < 2) errors.name = t('nameInvalid');

    if (address.lat === null || address.lng === null) {
      errors.coords = t('errors.invalid_address');
    }
    if (!address.formatted_address.trim()) {
      errors.text = t('errors.missing_address_text');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          contact: { phone: contact.phone, name: contact.name },
          address: {
            formatted_address: address.formatted_address,
            details: address.details,
            lat: address.lat,
            lng: address.lng,
          },
          payment_method: payment,
          notes,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          // Gift options (only present for gift carts); the API ignores them for retail.
          gift: giftOptions
            ? {
                recipient_name: giftOptions.recipient_name,
                gift_message: giftOptions.gift_message,
                scheduled_date: giftOptions.scheduled_date,
              }
            : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorKey = data?.error;
        const message = errorKey && t.has(`errors.${errorKey}`)
          ? t(`errors.${errorKey}`)
          : t('errors.generic');
        setSubmitError(message);
        return;
      }

      // Lock the empty-cart redirect, navigate first, clear the cart last.
      // The order matters: if we clear the cart before navigating, React schedules
      // a re-render with items=[] which races our router.push and can redirect
      // to /marketplace via the empty-cart useEffect.
      placedOrderRef.current = true;
      // Remember this order so the header "resume" button can bring the
      // customer back to live tracking after they leave or lock the phone.
      setActiveOrderCode(data.order.public_code);
      router.push(`/${locale}/track/${data.order.public_code}`);
      // Defer clearCart by a microtask so the navigation commits first.
      queueMicrotask(() => clearCart());
    } catch (err) {
      console.error(err);
      setSubmitError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  // While the cart is hydrating from localStorage, show a brief loader
  // instead of returning null (which would cause a flash of empty page).
  if (!hasHydrated) {
    return (
      <div className="px-5 py-16 flex justify-center">
        <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-5 pb-[180px]">
      {/* Contact */}
      <Section title={t('contactSection')}>
        <ContactSection
          value={contact}
          onChange={setContact}
          recognizedName={recognizedName && recognizedName !== contact.name ? recognizedName : null}
          onRecognized={({ name, addresses: addrs }) => {
            setRecognizedName(name);
            // Deduplicate: collapse repeats of the same address+details (keep most recent
            // which arrives first since the API orders by created_at desc). Cap at 3.
            const seen = new Set<string>();
            const unique: RecognizedAddress[] = [];
            for (const a of addrs) {
              const key = `${(a.formatted_address || '').trim().toLowerCase()}|${(a.details || '').trim().toLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              unique.push(a);
              if (unique.length >= 3) break;
            }
            setSavedAddresses(unique);
          }}
          errors={{ phone: fieldErrors.phone, name: fieldErrors.name }}
        />
      </Section>

      {/* Saved addresses (only if recognized + has addresses) */}
      {savedAddresses.length > 0 && (
        <Section title={t('savedAddresses')}>
          <div className="space-y-2">
            {savedAddresses.map((saved) => (
              <button
                key={saved.id}
                type="button"
                onClick={() => applySavedAddress(saved)}
                className="w-full flex items-start gap-2.5 p-3 rounded-xl surface hover:border-fig-600/30 active:scale-[0.99] transition-all text-left"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300 mt-0.5 shrink-0">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-cream-100 line-clamp-1">{saved.formatted_address}</div>
                  {saved.details && (
                    <div className="text-[11px] text-cream-100/55 line-clamp-1">{saved.details}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Address */}
      <Section title={t('addressSection')}>
        <AddressPicker
          value={address}
          onChange={setAddress}
          errors={{ coords: fieldErrors.coords, text: fieldErrors.text }}
        />
      </Section>

      {/* Gift details (only for gift carts) */}
      {giftOptions && (giftOptions.recipient_name || giftOptions.gift_message || giftOptions.scheduled_date) && (
        <Section title={t('giftSection')}>
          <div className="surface rounded-xl p-4 border border-gold-300/10 space-y-1.5 text-[13px]">
            {giftOptions.recipient_name && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-cream-100/55">{t('giftRecipient')}</span>
                <span className="text-cream-100 text-right">{giftOptions.recipient_name}</span>
              </div>
            )}
            {giftOptions.scheduled_date && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-cream-100/55">{t('giftDate')}</span>
                <span className="text-cream-100 text-right tabular-nums">{giftOptions.scheduled_date}</span>
              </div>
            )}
            {giftOptions.gift_message && (
              <div className="pt-1">
                <span className="text-cream-100/55">{t('giftMessage')}</span>
                <p className="text-cream-100 mt-0.5 italic leading-snug">«{giftOptions.gift_message}»</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Payment */}
      <Section title={t('paymentSection')}>
        <PaymentPicker value={payment} onChange={setPayment} />
      </Section>

      {/* Notes */}
      <Section title={t('notesSection')}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40 transition-all resize-none"
        />
      </Section>

      {/* Summary */}
      <Section title={t('summarySection')}>
        <div className="surface rounded-xl p-4 border border-gold-300/10 space-y-1.5">
          <SummaryRow label={t('subtotal')} value={`${formatSom(subtotal)} ${tc('som')}`} />
          <SummaryRow
            label={t('delivery')}
            value={deliveryFee === 0 ? '—' : `${formatSom(deliveryFee)} ${tc('som')}`}
            muted
          />
          <div className="h-px bg-black/[0.06] my-1.5" />
          <SummaryRow
            label={t('total')}
            value={`${formatSom(total)} ${tc('som')}`}
            bold
          />
        </div>
      </Section>

      {submitError && (
        <div className="mx-1 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-berry">
          {submitError}
        </div>
      )}

      {/* Sticky submit bar — positioned above the customer bottom nav (h-16 = 64px) */}
      <div className="fixed bottom-[64px] inset-x-0 mx-auto max-w-md px-5 pt-3 pb-3 bg-gradient-to-t from-cream via-cream/95 to-cream/0 z-20">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full btn-fig text-white py-3.5 rounded-2xl font-medium text-[15px] flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('placing')}
            </>
          ) : (
            <>
              {t('placeOrder')} · {formatSom(total)} {tc('som')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 animate-fade-up">
      <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2.5 px-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[13px] ${muted ? 'text-cream-100/55' : 'text-cream-100'}`}>{label}</span>
      <span
        className={`tabular-nums ${
          bold ? 'text-[16px] font-medium text-cream-100' : 'text-[13px] text-cream-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
