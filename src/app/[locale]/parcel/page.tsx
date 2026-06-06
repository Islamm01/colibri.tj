import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ParcelForm } from '@/components/parcel/ParcelForm';
import { readSession } from '@/lib/session/server';

export const dynamic = 'force-dynamic';

export default async function ParcelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('parcel');

  // If the customer has a soft account, pre-fill the sender side
  const session = await readSession();

  return (
    <div className="pb-32">
      <header className="px-5 pt-5 pb-3 animate-fade-up">
        <h1 className="font-serif text-[24px] text-cream-100 leading-tight">{t('title')}</h1>
        <p className="text-[13px] text-cream-100/55 mt-1">{t('subtitle')}</p>
      </header>

      <ParcelForm
        locale={locale}
        initialSenderName={session?.name ?? ''}
        initialSenderPhone={session?.phone ?? ''}
      />
    </div>
  );
}
