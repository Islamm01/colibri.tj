import Link from 'next/link';
import { defaultLocale } from '@/i18n/config';

// This is a global not-found handler. It is rendered when any `notFound()` call
// happens outside a `[locale]` segment, or when a route truly doesn't match.
// In Next.js 15 the root layout MUST have a `not-found.tsx` sibling, otherwise
// any `notFound()` call (even in nested layouts) throws NotAllowedRootNotFoundError at runtime.

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-cream px-6">
      <div className="text-center max-w-sm">
        <div className="font-serif text-fig-600 text-[28px] mb-2 tracking-wider">Colibri</div>
        <h1 className="font-serif text-[22px] text-ink-soft mb-2">404</h1>
        <p className="text-[13px] text-ink-muted mb-6">
          Саҳифа ёфт нашуд · Страница не найдена
        </p>
        <Link
          href={`/${defaultLocale}`}
          className="inline-flex items-center gap-2 btn-fig text-white px-5 py-2.5 rounded-xl text-[13px] font-medium"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}
