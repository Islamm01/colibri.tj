import { setRequestLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CourierApplyClient } from '@/components/courier/CourierApplyClient';

export const dynamic = 'force-dynamic';

export default async function CourierApplyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('courierApply');

  return (
    <div className="px-5 pt-5 pb-32">
      <Link href={`/${locale}/profile`} className="inline-flex items-center gap-1.5 text-[12px] text-cream-100/55 hover:text-gold-300 mb-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t('back')}
      </Link>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-fig-600 to-fig-800 p-6 text-white relative overflow-hidden">
        <div className="absolute -right-4 -bottom-6 text-[90px] opacity-[0.12] leading-none select-none">🛵</div>
        <div className="relative">
          <div className="text-[10px] font-medium text-gold-300 tracking-[2px] uppercase mb-2">{t('eyebrow')}</div>
          <h1 className="font-serif text-[26px] leading-tight">{t('title')}</h1>
          <p className="text-[13px] text-white/80 mt-2 leading-relaxed">{t('subtitle')}</p>
        </div>
      </div>

      <CourierApplyClient locale={locale} />
    </div>
  );
}
