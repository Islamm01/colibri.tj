import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PriceIndexClient } from '@/components/prices/PriceIndexClient';

export const dynamic = 'force-dynamic';

export default async function PricesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('prices');

  return (
    <div className="px-5 pt-5 pb-24">
      <div className="animate-fade-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-medium text-gold-600 tracking-[2px] uppercase">
            {t('eyebrow')}
          </span>
        </div>
        <h1 className="font-serif text-[26px] text-cream-100 leading-tight">{t('title')}</h1>
        <p className="text-[13px] text-cream-100/55 mt-1.5 leading-relaxed">{t('subtitle')}</p>
      </div>

      <PriceIndexClient locale={locale} />
    </div>
  );
}
