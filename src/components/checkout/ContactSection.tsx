'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface ContactValue {
  phone: string;
  name: string;
}

export interface RecognizedAddress {
  id: string;
  formatted_address: string;
  details: string | null;
  lat: number;
  lng: number;
}

interface Props {
  value: ContactValue;
  onChange: (next: ContactValue) => void;
  onRecognized?: (info: { name: string; addresses: RecognizedAddress[] }) => void;
  recognizedName?: string | null;
  errors?: { phone?: string; name?: string };
}

export function ContactSection({ value, onChange, onRecognized, recognizedName, errors }: Props) {
  const t = useTranslations('checkout');
  const [recognizing, setRecognizing] = useState(false);
  const lastChecked = useRef<string>('');

  // Recognize phone after user stops typing (350ms debounce)
  useEffect(() => {
    const phone = value.phone.trim();
    if (phone.length < 9 || phone === lastChecked.current) return;

    const timer = setTimeout(async () => {
      lastChecked.current = phone;
      setRecognizing(true);
      try {
        const res = await fetch('/api/session/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (data?.recognized && data?.user) {
          // Only auto-fill the name if user hasn't typed one yet
          if (!value.name.trim()) {
            onChange({ ...value, name: data.user.name });
          }
          onRecognized?.({ name: data.user.name, addresses: data.addresses ?? [] });
        }
      } catch {
        // Silent — recognition is a UX nicety, not critical
      } finally {
        setRecognizing(false);
      }
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.phone]);

  return (
    <div className="space-y-3">
      {recognizedName && (
        <div className="px-3.5 py-2.5 bg-gold-300/15 rounded-xl text-[12px] text-gold-300 font-medium animate-fade-in">
          {t('welcomeBack', { name: recognizedName })}
        </div>
      )}

      <div>
        <label className="text-[11px] text-cream-100/45 mb-1.5 px-1 block">{t('phone')}</label>
        <div className="relative">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder={t('phonePlaceholder')}
            className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40 transition-all"
          />
          {recognizing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-3 h-3 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {errors?.phone && <p className="text-[11px] text-berry mt-1.5 px-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="text-[11px] text-cream-100/45 mb-1.5 px-1 block">{t('name')}</label>
        <input
          type="text"
          autoComplete="name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={t('namePlaceholder')}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40 transition-all"
        />
        {errors?.name && <p className="text-[11px] text-berry mt-1.5 px-1">{errors.name}</p>}
      </div>
    </div>
  );
}
