'use client';

import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@/lib/types';

const STATUS_ORDER: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'courier_assigned',
  'picked_up',
  'delivered',
];

interface Props {
  status: OrderStatus;
}

export function StatusTimeline({ status }: Props) {
  const t = useTranslations('track');

  if (status === 'cancelled') {
    return (
      <div className="px-4 py-3 bg-red-50 rounded-xl">
        <div className="text-[13px] text-berry font-medium">{t('status.cancelled')}</div>
      </div>
    );
  }

  if (status === 'pending_payment') {
    return (
      <div className="px-4 py-3 bg-amber-50 rounded-xl flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <div className="text-[13px] text-amber-900 font-medium">{t('status.pending_payment')}</div>
      </div>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(status);
  // Compress 7 statuses into 4 visible milestones for cleaner mobile UX
  const milestones: { key: OrderStatus; reachedAt: number }[] = [
    { key: 'placed', reachedAt: 0 },
    { key: 'preparing', reachedAt: 2 },
    { key: 'picked_up', reachedAt: 5 },
    { key: 'delivered', reachedAt: 6 },
  ];

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-black/[0.08]" aria-hidden="true" />
      <div className="space-y-3.5">
        {milestones.map((m, idx) => {
          const reached = currentIndex >= m.reachedAt;
          const active = currentIndex >= m.reachedAt && (idx === milestones.length - 1 || currentIndex < milestones[idx + 1].reachedAt);
          return (
            <div key={m.key} className="flex items-center gap-3 relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all relative z-10 ${
                  reached ? 'btn-gold shadow-fig-glow' : 'surface border-2 border-gold-300/10 text-cream-100/35'
                }`}
              >
                {reached ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
                {active && reached && (
                  <span className="absolute inset-0 rounded-full bg-fig-600 animate-ping opacity-30" aria-hidden="true" />
                )}
              </div>
              <span className={`text-[13px] ${reached ? 'text-cream-100 font-medium' : 'text-cream-100/55'}`}>
                {t(`status.${m.key}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
