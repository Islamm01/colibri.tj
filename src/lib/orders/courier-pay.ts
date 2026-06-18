import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_COURIER_COMMISSION_RATE = 0.2;

/** Clamp any stored/typed rate into a sane 0–1 fraction. */
export function normalizeRate(rate: unknown): number {
  const r = Number(rate);
  if (!Number.isFinite(r)) return DEFAULT_COURIER_COMMISSION_RATE;
  return Math.min(1, Math.max(0, r));
}

/**
 * The courier's payout for a delivery = the delivery fee minus the platform's
 * configured cut. Rounded to 2 decimals.
 */
export function courierEarning(deliveryFee: unknown, platformRate: unknown): number {
  const fee = Number(deliveryFee) || 0;
  const rate = normalizeRate(platformRate);
  return Math.round(fee * (1 - rate) * 100) / 100;
}

/** Read the current platform cut of delivery fees (defaults to 20%). */
export async function getCourierCommissionRate(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('courier_commission_rate')
    .eq('id', 1)
    .maybeSingle();
  return normalizeRate(data?.courier_commission_rate ?? DEFAULT_COURIER_COMMISSION_RATE);
}
