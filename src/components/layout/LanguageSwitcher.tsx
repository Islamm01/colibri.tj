'use client';

import { usePathname, useRouter } from 'next/navigation';
import { locales, localeShort, type Locale } from '@/i18n/config';
import { cn } from '@/lib/cn';

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (next: Locale) => {
    if (next === currentLocale) return;
    // Replace the locale segment in the path
    const segments = pathname.split('/');
    segments[1] = next;
    router.push(segments.join('/'));
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-0.5 px-1 py-0.5 border border-white/10 rounded-full surface/[0.06]"
    >
      {locales.map((loc, idx) => (
        <div key={loc} className="flex items-center">
          <button
            onClick={() => switchLocale(loc)}
            className={cn(
              'px-2 py-0.5 text-[11px] font-semibold rounded-full transition-colors',
              currentLocale === loc
                ? 'text-gold-300'
                : 'text-cream-100/50 hover:text-cream-100',
            )}
            aria-pressed={currentLocale === loc}
          >
            {localeShort[loc]}
          </button>
          {idx < locales.length - 1 && (
            <span className="text-cream-100/25 text-[11px]" aria-hidden="true">|</span>
          )}
        </div>
      ))}
    </div>
  );
}
