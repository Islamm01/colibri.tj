'use client';

import { useTranslations } from 'next-intl';

interface Props {
  handle?: string;
}

/**
 * Support footer at the very bottom of the home screen.
 * Replaces the floating FAB — a calmer, clearer placement: a labelled
 * "write to us on Telegram" row plus the brand line.
 */
export function HomeSupportFooter({ handle = 'colibri_support' }: Props) {
  const t = useTranslations('support');

  return (
    <footer className="px-5 pt-4 pb-10 mt-2">
      <a
        href={`https://t.me/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 surface rounded-2xl px-4 py-3.5 card-lift"
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[0_4px_12px_-2px_rgba(34,158,217,0.5)]"
          style={{ background: 'linear-gradient(135deg, #37BBFE 0%, #1E96C8 100%)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M22.05 3.06a1.27 1.27 0 0 0-1.3-.2L2.62 9.96c-.86.34-.83 1.57.04 1.86l4.3 1.42 1.62 5.16c.2.64 1 .85 1.5.4l2.4-2.17 4.27 3.14a1.27 1.27 0 0 0 2-.78l3.66-14.4a1.27 1.27 0 0 0-.36-1.53ZM9.1 13.3l8.2-5.06c.18-.11.37.13.22.28l-6.77 6.3a.9.9 0 0 0-.28.54l-.23 1.7a.2.2 0 0 1-.39.03L8.9 13.7a.45.45 0 0 1 .2-.4Z" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-cream-100">{t('footerTitle')}</div>
          <div className="text-[11.5px] text-cream-100/50">{t('footerHint')}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100/35 shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </a>

      <div className="text-center mt-5">
        <div className="font-serif text-[15px] text-gold-300 tracking-wide">Colibri</div>
        <div className="text-[10px] text-cream-100/40 mt-0.5">{t('tagline')}</div>
      </div>
    </footer>
  );
}
