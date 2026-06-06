import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // Fall back to default locale if the requested one isn't valid.
  // We don't call notFound() here because in dev mode Next.js sometimes
  // pre-renders routes before middleware has a chance to redirect — and
  // a stray notFound() call without a root not-found.tsx triggers
  // NotAllowedRootNotFoundError. The middleware handles the real redirect.
  const locale: Locale = (locales as readonly string[]).includes(requested ?? '')
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
