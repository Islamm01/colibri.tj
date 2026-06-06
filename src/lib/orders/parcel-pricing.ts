// =====================================================================
// Colibri — Parcel delivery pricing
//
// Distance-based pricing inspired by Yandex Go's parcel tariffs in CIS,
// adapted for Khujand:
//   - Base fare: 15 TJS (covers first 2 km)
//   - Per-km after base: 4 TJS/km
//   - Weight band: under 5 kg standard; 5-15 kg adds 10 TJS surcharge
//   - All distances calculated via haversine (straight-line) — good enough
//     for a city the size of Khujand
// =====================================================================

import { distanceKm } from '@/lib/orders/pricing';

export const PARCEL_BASE_FARE = 15; // TJS
export const PARCEL_BASE_KM = 2;
export const PARCEL_PER_KM = 4; // TJS per km after base
export const PARCEL_HEAVY_SURCHARGE = 10; // TJS for 5-15 kg band
export const PARCEL_MAX_KG = 15; // refuse anything heavier — couriers are on bikes
export const PARCEL_MAX_KM = 25; // refuse cross-city; Khujand is ~10 km diameter

export type ParcelWeightBand = 'light' | 'heavy'; // <5kg | 5-15kg

export interface ParcelQuote {
  /** Straight-line km between pickup and dropoff. */
  distance_km: number;
  /** Base fare. */
  base_fare: number;
  /** Km surcharge over base. */
  distance_surcharge: number;
  /** Heavy-package surcharge. */
  weight_surcharge: number;
  /** Total to display to the sender. */
  total: number;
}

export function quoteParcel(opts: {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  weight: ParcelWeightBand;
}): ParcelQuote {
  const d = distanceKm(opts.pickupLat, opts.pickupLng, opts.dropoffLat, opts.dropoffLng);
  const chargeableKm = Math.max(0, d - PARCEL_BASE_KM);
  const distance_surcharge = Math.round(chargeableKm * PARCEL_PER_KM);
  const weight_surcharge = opts.weight === 'heavy' ? PARCEL_HEAVY_SURCHARGE : 0;
  const total = PARCEL_BASE_FARE + distance_surcharge + weight_surcharge;

  return {
    distance_km: Math.round(d * 10) / 10,
    base_fare: PARCEL_BASE_FARE,
    distance_surcharge,
    weight_surcharge,
    total,
  };
}

export function validateParcelDistance(distanceKm: number): { ok: boolean; reason?: string } {
  if (distanceKm > PARCEL_MAX_KM) {
    return { ok: false, reason: 'too_far' };
  }
  return { ok: true };
}
