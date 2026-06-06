import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { readSession } from '@/lib/session/server';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tn = await getTranslations('nav');
  const t = await getTranslations('profile');
  const session = await readSession();

  return (
    <div className="px-5 py-6">
      <h1 className="font-serif text-[24px] text-cream-100 leading-tight mb-5 animate-fade-up">
        {tn('profile')}
      </h1>

      {/* User card — informational, not a button */}
      <div className="surface rounded-2xl border border-gold-300/10 p-5 shadow-card animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gold-300/15 flex items-center justify-center text-gold-300">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-cream-100">
              {session?.name ?? t('guestName')}
            </div>
            <div className="text-[11px] text-cream-100/55 truncate">
              {session?.phone ?? t('guestHint')}
            </div>
          </div>
        </div>
      </div>

      {/* Settings — language only, removed broken "soon" items */}
      <div
        className="mt-5 surface rounded-2xl border border-gold-300/10 divide-y divide-gold-300/10 shadow-card animate-fade-up"
        style={{ animationDelay: '0.05s' }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[13px] text-cream-100">{t('language')}</span>
          <LanguageSwitcher currentLocale={locale as Locale} />
        </div>

        <Link
          href={`/${locale}/orders`}
          className="flex items-center justify-between px-5 py-4 hover:bg-forest-600/40 transition-colors"
        >
          <span className="text-[13px] text-cream-100">{t('myOrders')}</span>
          <Chevron />
        </Link>
      </div>

      {/* Become a partner — routes to a real application form, not staff login */}
      <Link
        href={`/${locale}/partner`}
        className="mt-5 flex items-center justify-between px-4 py-4 surface rounded-2xl border border-gold-300/25 hover:border-gold-300/50 transition-colors animate-fade-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-gold-700 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-cream-100">{t('becomePartner')}</div>
            <div className="text-[11px] text-cream-100/55">{t('becomePartnerHint')}</div>
          </div>
        </div>
        <Chevron />
      </Link>

      {/* Become a courier — same style as partner */}
      <Link
        href={`/${locale}/courier-apply`}
        className="mt-3 flex items-center justify-between px-4 py-4 surface rounded-2xl border border-gold-300/25 hover:border-gold-300/50 transition-colors animate-fade-up"
        style={{ animationDelay: '0.13s' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-gold-700 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M15 17.5h-6l-2-7h11l-1.5 5" />
              <path d="M9 10.5 7.5 5H5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-cream-100">{t('becomeCourier')}</div>
            <div className="text-[11px] text-cream-100/55">{t('becomeCourierHint')}</div>
          </div>
        </div>
        <Chevron />
      </Link>

      {/* Staff dashboard entry — distinct appearance and color */}
      <Link
        href="/staff/login"
        className="mt-5 flex items-center justify-between px-4 py-4 rounded-2xl bg-fig-700/40 border border-berry-500/40 hover:border-berry-500/70 hover:bg-fig-700/60 transition-colors animate-fade-up"
        style={{ animationDelay: '0.16s' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-berry-500/15 flex items-center justify-center text-berry-400 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-medium text-cream-100">{t('staffPortal')}</div>
            <div className="text-[11px] text-cream-100/55">{t('staffPortalHint')}</div>
          </div>
        </div>
        <Chevron color="text-berry-400" />
      </Link>

      <p className="text-center text-[10px] text-cream-100/35 mt-8">Colibri · v0.4</p>
    </div>
  );
}

function Chevron({ color = 'text-cream-100/35' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={color}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
