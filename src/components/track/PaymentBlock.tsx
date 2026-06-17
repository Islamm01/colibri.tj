'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatSom } from '@/lib/format';
import type { OrderStatus, PaymentMethod } from '@/lib/types';

interface Props {
  publicCode: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'awaiting_confirmation' | 'paid' | 'failed' | 'refunded';
  orderStatus: OrderStatus;
  amount: number;
  somLabel: string;
  onConfirmed: () => void;
}

interface Settings {
  qr_image_url: string | null;
  qr_label: string | null;
  card_number: string | null;
  card_holder: string | null;
  bank_name: string | null;
  transfer_note: string | null;
}

export function PaymentBlock({ publicCode, paymentMethod, paymentStatus, amount, somLabel, onConfirmed }: Props) {
  const t = useTranslations('track');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (paymentMethod === 'cash') return;
    (async () => {
      try {
        const res = await fetch('/api/payment-settings');
        const data = await res.json();
        setSettings(data.settings ?? null);
      } catch {
        setSettings(null);
      }
    })();
  }, [paymentMethod]);

  // Cash never needs an online step
  if (paymentMethod === 'cash') return null;
  // Fully paid: nothing to show
  if (paymentStatus === 'paid' || paymentStatus === 'refunded') return null;

  // Customer already claimed payment — waiting on staff/provider confirmation
  if (paymentStatus === 'awaiting_confirmation') {
    return (
      <div className="surface rounded-2xl border border-blue-200 shadow-card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <div>
            <div className="text-[13px] font-medium text-cream-100">{t('paymentChecking')}</div>
            <div className="text-[11px] text-cream-100/55">{t('paymentCheckingHint')}</div>
          </div>
        </div>
      </div>
    );
  }

  async function handleConfirm() {
    setError(null);
    setConfirming(true);
    try {
      const res = await fetch(`/api/orders/by-code/${publicCode}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: reference.trim() || undefined }),
      });
      if (!res.ok) {
        setError(t('paymentError'));
        return;
      }
      onConfirmed();
    } catch {
      setError(t('paymentError'));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="surface rounded-2xl border border-amber-200 shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[12px] font-medium text-amber-900">{t('needToPay')}</span>
      </div>

      <div className="p-4">
        {/* Amount due — the first thing the customer needs to know */}
        <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-gold-300/10">
          <span className="text-[12px] text-cream-100/55">{t('amountDue')}</span>
          <span className="font-serif text-[22px] text-gold-300 tabular-nums leading-none">
            {formatSom(amount)} <span className="text-[13px] text-cream-100/55 font-sans">{somLabel}</span>
          </span>
        </div>

        <p className="text-[12px] text-cream-100/70 leading-relaxed mb-3">
          {paymentMethod === 'qr' ? t('payHintQr') : t('payHintBank')}
        </p>

        {paymentMethod === 'qr' ? (
          <>
            <div className="flex justify-center mb-3">
              {settings?.qr_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.qr_image_url}
                  alt="QR"
                  className="w-44 h-44 object-contain rounded-lg border border-gold-300/10 surface p-1.5"
                />
              ) : (
                <div className="w-44 h-44 rounded-lg border border-dashed border-black/15 flex items-center justify-center text-center px-4">
                  <span className="text-[11px] text-cream-100/55">{t('qrNotConfigured')}</span>
                </div>
              )}
            </div>
            <p className="text-[12px] text-cream-100/55 text-center mb-3">
              {settings?.qr_label || t('qrPlaceholder')}
            </p>
          </>
        ) : (
          <>
            <div className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2">
              {t('bankDetails')}
            </div>
            <div className="bg-forest-700 rounded-lg p-3 space-y-1.5 mb-3">
              {settings?.bank_name && (
                <div className="text-[13px] text-cream-100 font-medium">{settings.bank_name}</div>
              )}
              {settings?.card_number ? (
                <div className="text-[14px] text-cream-100 font-mono tracking-wide select-all">
                  {settings.card_number}
                </div>
              ) : (
                <div className="text-[12px] text-cream-100/55">{t('bankNotConfigured')}</div>
              )}
              {settings?.card_holder && (
                <div className="text-[12px] text-cream-100/55">{settings.card_holder}</div>
              )}
              <div className="text-[11px] text-cream-100/55 pt-1 border-t border-gold-300/10">
                {t('bankReference', { code: publicCode })}
              </div>
              {settings?.transfer_note && (
                <div className="text-[11px] text-cream-100/55">{settings.transfer_note}</div>
              )}
            </div>
          </>
        )}

        {/* Optional transaction reference */}
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t('referencePlaceholder')}
          className="w-full px-3 py-2.5 mb-2.5 rounded-lg border border-gold-300/12 text-[13px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:border-fig-600/40"
        />

        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full btn-fig text-white py-3 rounded-xl font-medium text-[13px] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {confirming ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ...
            </>
          ) : (
            t('iHavePaid')
          )}
        </button>
        {error && <p className="text-[11px] text-berry mt-2 text-center">{error}</p>}
      </div>
    </div>
  );
}
