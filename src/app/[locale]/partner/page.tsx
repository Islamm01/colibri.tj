import { setRequestLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PartnerForm } from '@/components/partner/PartnerForm';
import { readSession } from '@/lib/session/server';

export const dynamic = 'force-dynamic';

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('partner');
  const session = await readSession();

  return (
    <div className="px-5 pt-5 pb-32">
      <Link
        href={`/${locale}/profile`}
        className="inline-flex items-center gap-1.5 text-[12px] text-cream-100/55 hover:text-gold-300 mb-4"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t('back')}
      </Link>

      <h1 className="font-serif text-[26px] text-cream-100 leading-tight">{t('title')}</h1>
      <p className="text-[14px] text-cream-100/55 mt-2 leading-relaxed">{t('subtitle')}</p>

      <PartnerForm
        locale={locale}
        defaultContactName={session?.name ?? ''}
        defaultPhone={session?.phone ?? ''}
      />
    </div>
  );
}
