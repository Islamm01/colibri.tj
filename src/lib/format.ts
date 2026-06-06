import type { OpeningHours, Store } from './types';

export function formatSom(amount: number): string {
  // Tajikistan somoni — typically displayed without thousands separators for small amounts,
  // and with 0-2 decimals depending on context.
  if (Number.isInteger(amount)) return `${amount}`;
  return amount.toFixed(2);
}

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function isStoreOpenNow(store: Pick<Store, 'opening_hours' | 'is_paused'>): {
  open: boolean;
  closesAt: string | null;
} {
  if (store.is_paused) return { open: false, closesAt: null };
  if (!store.opening_hours) return { open: true, closesAt: null };

  const now = new Date();
  const dayKey = dayKeys[now.getDay()];
  const todayHours = store.opening_hours[dayKey];
  if (!todayHours) return { open: false, closesAt: null };

  const [openStr, closeStr] = todayHours;
  const [openH, openM] = openStr.split(':').map(Number);
  const [closeH, closeM] = closeStr.split(':').map(Number);

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const minutesOpen = openH * 60 + openM;
  const minutesClose = closeH * 60 + closeM;

  const open = minutesNow >= minutesOpen && minutesNow < minutesClose;
  return { open, closesAt: open ? closeStr : null };
}
