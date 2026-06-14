import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CustomRequestForm } from '@/components/gifts/CustomRequestForm';

export const dynamic = 'force-dynamic';

export default async function CustomGiftPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('gifts');
  const tc = await getTranslations('common');

  return (
    <div className="pb-10">
      <header className="px-5 pt-5 pb-4 animate-fade-up">
        <Link
          href={`/${locale}/gifts`}
          className="inline-flex items-center gap-1.5 text-[12px] text-cream-100/55 hover:text-gold-300 transition-colors mb-2.5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {tc('back')}
        </Link>
        <p className="text-[11px] font-medium tracking-[2px] uppercase text-gold-300/90">{t('brand')}</p>
        <h1 className="font-serif text-[24px] text-cream-100 leading-tight mt-1">{t('custom.title')}</h1>
        <p className="text-[13px] text-cream-100/55 mt-1.5 leading-snug">{t('custom.subtitle')}</p>
      </header>

      <CustomRequestForm locale={locale} />
    </div>
  );
}
