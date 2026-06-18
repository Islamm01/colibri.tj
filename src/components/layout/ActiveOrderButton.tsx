'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getActiveOrderCode, clearActiveOrderCode } from '@/lib/active-order';

const TERMINAL = ['delivered', 'cancelled'];

// A bright "resume your order" button shown in the header whenever the
// customer has a live order on this device. Tapping it reopens live tracking.
// Re-checks the order's status when the app regains focus, and hides itself
// once the order is delivered or cancelled.
export function ActiveOrderButton() {
  const locale = useLocale();
  const t = useTranslations('header');
  const [code, setCode] = useState<string | null>(null);

  const check = useCallback(async () => {
    const c = getActiveOrderCode();
    if (!c) {
      setCode(null);
      return;
    }
    // Show immediately from storage; verify status in the background.
    setCode(c);
    try {
      const res = await fetch(`/api/orders/by-code/${c}`, { cache: 'no-store' });
      if (res.status === 404) {
        clearActiveOrderCode();
        setCode(null);
        return;
      }
      if (!res.ok) return; // transient error — keep the last known state
      const data = await res.json();
      const status: string | undefined = data?.order?.status;
      if (status && TERMINAL.includes(status)) {
        clearActiveOrderCode();
        setCode(null);
      }
    } catch {
      // Offline — keep showing the button so they can still navigate.
    }
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    // Same-tab set/clear (checkout) and cross-tab storage changes.
    window.addEventListener('colibri:active-order', check);
    window.addEventListener('storage', check);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('colibri:active-order', check);
      window.removeEventListener('storage', check);
    };
  }, [check]);

  if (!code) return null;

  return (
    <Link
      href={`/${locale}/track/${code}`}
      aria-label={t('activeOrder')}
      title={t('activeOrder')}
      className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gold-300 text-forest-900 shadow-[0_0_12px_rgba(200,241,105,0.5)] active:scale-95 transition-transform"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7Z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      </svg>
      {/* Live pulse so it reads as "active / something is happening" */}
      <span className="absolute -top-0.5 -right-0.5 flex w-2.5 h-2.5">
        <span className="absolute inline-flex w-full h-full rounded-full bg-berry-500 opacity-70 animate-ping" />
        <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-berry-500 border-2 border-forest-900" />
      </span>
    </Link>
  );
}
