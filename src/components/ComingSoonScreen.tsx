'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

interface Props {
  icon: React.ReactNode;
  titleKey: string;
  hintKey?: string;
  scope: 'verticals.parcel' | 'nav';
  action?: { label: string; href: string };
}

export function ComingSoonScreen({ icon, titleKey, hintKey, scope, action }: Props) {
  const locale = useLocale();
  const t = useTranslations(scope);
  const tc = useTranslations('common');

  return (
    <div className="px-8 py-16 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-gold-300/15 flex items-center justify-center mb-5 text-gold-300 animate-pop">
        {icon}
      </div>
      <h1 className="font-serif text-[22px] text-cream-100 leading-tight">{t(titleKey)}</h1>
      {hintKey && (
        <p className="text-[13px] text-cream-100/55 mt-2 leading-relaxed max-w-[260px]">
          {t(hintKey)}
        </p>
      )}
      <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-gold-300 font-medium bg-gold-300/15 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-fig-600 animate-pulse" />
        {tc('soon')}
      </div>
      {action && (
        <Link
          href={action.href}
          className="mt-6 btn-fig text-white px-5 py-2.5 rounded-xl text-[13px] font-medium"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
