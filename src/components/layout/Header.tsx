'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { Locale } from '@/i18n/config';

export function Header({ locale }: { locale: Locale }) {
  const t = useTranslations('header');

  return (
    <header className="glass-forest fixed top-0 inset-x-0 z-40 mx-auto max-w-md">
      <div className="flex items-center justify-between px-4 h-[60px]">
        {/* Location — small, clean */}
        <button className="flex items-center gap-1 text-cream-100/80 min-w-0 max-w-[34%]" aria-label={t('changeLocation')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300 shrink-0">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-[13px] font-medium truncate">{t('location')}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100/50 shrink-0">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Brand — centered wordmark with a refined gold accent dot */}
        <Link
          href={`/${locale}`}
          className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-1"
          aria-label="Colibri home"
        >
          <span className="font-serif text-[21px] tracking-[0.06em] text-cream-100">Colibri</span>
          <span className="w-[6px] h-[6px] rounded-full bg-gold-300 shadow-[0_0_8px_rgba(200,241,105,0.7)] mb-0.5" />
        </Link>

        {/* Language */}
        <div className="shrink-0">
          <LanguageSwitcher currentLocale={locale} />
        </div>
      </div>
    </header>
  );
}
