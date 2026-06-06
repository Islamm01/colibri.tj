import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Match all paths INCLUDING the root, except API, static files, Next internals,
  // and the /staff tree (staff dashboard is locale-independent).
  matcher: [
    '/',
    '/(tj|ru)/:path*',
    '/((?!_next|_vercel|api|staff|.*\\..*).*)',
  ],
};
