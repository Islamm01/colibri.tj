import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { locales, type Locale } from '@/i18n/config';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { CartDrawer } from '@/components/cart/CartDrawer';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale = (locales as readonly string[]).includes(locale) ? locale : 'tj';

  setRequestLocale(validLocale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={validLocale} messages={messages}>
      <div className="dark-app mx-auto max-w-md min-h-dvh relative">
        <Header locale={validLocale as Locale} />
        <main className="pt-[60px] pb-[104px]">{children}</main>
        <BottomNav />
        <CartDrawer />
      </div>
    </NextIntlClientProvider>
  );
}
