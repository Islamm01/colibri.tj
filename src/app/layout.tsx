import type { Metadata, Viewport } from 'next';
import { Onest, Lora } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import './globals.css';

const sans = Onest({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const serif = Lora({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['500', '600'],
  variable: '--font-dm-serif',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#071E15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://colibri.tj'),
  title: 'Colibri — Бозори маҳаллии маҳсулоти тоза',
  description: 'Меваҳои тоза, чормағз ва расондани зуд. Бе бақайдгирӣ.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Colibri' },
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getLocale reads the locale from next-intl context (set by middleware via URL prefix).
  // Falls back to the default locale if not yet available (e.g. mid-redirect from /).
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
