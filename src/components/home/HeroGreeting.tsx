'use client';

import { useTranslations } from 'next-intl';

export function HeroGreeting({ name }: { name?: string | null }) {
  const t = useTranslations('home');
  const greeting = name ? t('greetingNamed', { name }) : t('greeting');

  return (
    <section className="px-5 pt-5 pb-1">
      {/* Hummingbird mark + greeting */}
      <div className="flex items-center gap-3.5 animate-fade-up">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/colibri-mark-white.png"
          alt=""
          width={52}
          height={52}
          className="shrink-0 select-none drop-shadow-[0_2px_12px_rgba(200,241,105,0.20)]"
          draggable={false}
        />
        <div>
          <h1 className="font-serif text-[27px] leading-[1.05] text-cream-100">{greeting}</h1>
          <p className="text-[13px] text-cream-100/55 mt-1">{t('greetingQuestion')}</p>
        </div>
      </div>
    </section>
  );
}
