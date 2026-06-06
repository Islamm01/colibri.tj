import { setRequestLocale, getTranslations } from 'next-intl/server';
import { readSession } from '@/lib/session/server';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('checkout');

  const session = await readSession();

  return (
    <div>
      <div className="px-5 pt-2 pb-5 animate-fade-up">
        <h1 className="font-serif text-[24px] text-cream-100 leading-tight">{t('title')}</h1>
      </div>
      <CheckoutForm
        initialSession={session ? { name: session.name, phone: session.phone } : null}
      />
    </div>
  );
}
