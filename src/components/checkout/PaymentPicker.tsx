'use client';

import { useTranslations } from 'next-intl';
import type { PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Props {
  value: PaymentMethod;
  onChange: (next: PaymentMethod) => void;
}

const methods: Array<{
  key: PaymentMethod;
  labelKey: string;
  hintKey: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'cash',
    labelKey: 'paymentCash',
    hintKey: 'paymentCashHint',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 10v.01M18 14v.01" />
      </svg>
    ),
  },
  {
    key: 'qr',
    labelKey: 'paymentQr',
    hintKey: 'paymentQrHint',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
      </svg>
    ),
  },
  {
    key: 'bank_transfer',
    labelKey: 'paymentBank',
    hintKey: 'paymentBankHint',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v10h14V10" />
        <path d="M9 14v4M15 14v4M3 21h18" />
      </svg>
    ),
  },
];

export function PaymentPicker({ value, onChange }: Props) {
  const t = useTranslations('checkout');

  return (
    <div className="space-y-2">
      {methods.map((method) => {
        const active = value === method.key;
        return (
          <button
            key={method.key}
            type="button"
            onClick={() => onChange(method.key)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
              active
                ? 'bg-gold-300/15 border-fig-600/40 shadow-soft'
                : 'surface border-gold-300/10 hover:border-gold-300/15',
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                active ? 'btn-gold' : 'bg-forest-700 text-cream-100/55',
              )}
            >
              {method.icon}
            </span>
            <span className="flex-1 text-left">
              <span className="block text-[13px] font-medium text-cream-100">{t(method.labelKey)}</span>
              <span className="block text-[11px] text-cream-100/55">{t(method.hintKey)}</span>
            </span>
            <span
              className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                active ? 'border-fig-600 bg-fig-600' : 'border-black/15',
              )}
            >
              {active && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
