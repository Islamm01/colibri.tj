'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useCart, selectItemCount } from '@/lib/cart-store';
import { cn } from '@/lib/cn';

interface Tab {
  key: 'home' | 'search' | 'gifts' | 'cart' | 'orders' | 'profile';
  href: (locale: string) => string;
  icon: React.ReactNode;
  match: (path: string, locale: string) => boolean;
  isAction?: boolean; // cart opens drawer instead of navigating
}

const Icon = {
  Home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5Z" />
    </svg>
  ),
  Search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Gift: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 4 9 7 12 7Zm0 0s3-5 5.5-3S15 7 12 7Z" />
    </svg>
  ),
  Bag: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7Z" />
      <path d="M9 7V5a3 3 0 1 1 6 0v2" />
    </svg>
  ),
  Receipt: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  User: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
};

export function BottomNav() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const itemCount = useCart(selectItemCount);
  const hasHydrated = useCart((s) => s._hasHydrated);
  const openCart = useCart((s) => s.openDrawer);

  // Only display the badge after hydration to avoid hydration mismatch
  // and badge flicker on first paint.
  const showBadge = hasHydrated && itemCount > 0;

  const tabs: Tab[] = [
    { key: 'home', href: (l) => `/${l}`, icon: Icon.Home, match: (p, l) => p === `/${l}` },
    { key: 'search', href: (l) => `/${l}/marketplace`, icon: Icon.Search, match: (p, l) => p.startsWith(`/${l}/marketplace`) },
    { key: 'gifts', href: (l) => `/${l}/gifts`, icon: Icon.Gift, match: (p, l) => p.startsWith(`/${l}/gifts`) },
    { key: 'cart', href: (l) => `/${l}`, icon: Icon.Bag, match: () => false, isAction: true },
    { key: 'orders', href: (l) => `/${l}/orders`, icon: Icon.Receipt, match: (p, l) => p.startsWith(`/${l}/orders`) },
    { key: 'profile', href: (l) => `/${l}/profile`, icon: Icon.User, match: (p, l) => p.startsWith(`/${l}/profile`) },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-md px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      aria-label="Primary"
    >
      <div className="float-pill rounded-[1.75rem] px-2 py-2 flex justify-around items-center pointer-events-auto">
        {tabs.map((tab) => {
          const active = tab.match(pathname, locale);
          const content = (
            <span
              className={cn(
                'flex flex-col items-center gap-0.5 transition-all relative px-3 py-1.5 rounded-2xl',
                active ? 'text-forest-900 bg-gold-300' : 'text-cream-100/70',
              )}
            >
              <span className="relative">
                {tab.icon}
                {tab.key === 'cart' && showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-berry text-white text-[10px] font-semibold flex items-center justify-center animate-pop shadow-[0_2px_8px_rgba(255,79,94,0.5)]"
                    aria-label={`${itemCount} items in cart`}
                  >
                    {itemCount}
                  </span>
                )}
              </span>
              <span className="text-[9.5px] leading-tight font-medium">{t(tab.key)}</span>
            </span>
          );

          if (tab.isAction) {
            return (
              <button key={tab.key} onClick={openCart} className="flex-1 flex justify-center" aria-label={t(tab.key)}>
                {content}
              </button>
            );
          }
          return (
            <Link key={tab.key} href={tab.href(locale)} className="flex-1 flex justify-center">
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
