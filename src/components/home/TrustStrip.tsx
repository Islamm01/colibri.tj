'use client';

import { useTranslations } from 'next-intl';

export function TrustStrip() {
  const t = useTranslations('home');

  const items = [
    {
      label: t('trustFast'),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      label: t('trustNoReg'),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-5 pt-3 pb-2 flex items-center gap-3.5 text-[11px] text-cream-100/55 animate-fade-in">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-gold-300">{item.icon}</span>
          <span>{item.label}</span>
          {i < items.length - 1 && (
            <span className="ml-3 w-0.5 h-0.5 rounded-full bg-forest-700/25" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
