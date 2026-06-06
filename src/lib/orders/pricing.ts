// =====================================================================
// Order business logic — code generation, pricing, distance
// =====================================================================

const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generatePublicCode(): string {
  let code = 'COL-';
  for (let i = 0; i < 4; i++) {
    code += PUBLIC_CODE_ALPHABET[Math.floor(Math.random() * PUBLIC_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Haversine distance between two lat/lng points, in kilometers.
 */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface DeliveryFeeInput {
  subtotal: number;
  distanceKm: number;
  baseFee: number;
  includedKm: number;
  perKmRate: number;
  freeDeliveryThreshold: number | null;
}

export interface DeliveryFeeBreakdown {
  fee: number;
  free: boolean;
  reason: 'free_threshold' | 'base_only' | 'distance_surcharge';
  distanceKm: number;
}

export function calculateDeliveryFee(input: DeliveryFeeInput): DeliveryFeeBreakdown {
  const { subtotal, distanceKm, baseFee, includedKm, perKmRate, freeDeliveryThreshold } = input;

  if (freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold) {
    return { fee: 0, free: true, reason: 'free_threshold', distanceKm };
  }

  const extraKm = Math.max(0, distanceKm - includedKm);
  if (extraKm === 0) {
    return { fee: baseFee, free: false, reason: 'base_only', distanceKm };
  }

  // Round to nearest 0.5 som for cleaner pricing
  const fee = Math.round((baseFee + extraKm * perKmRate) * 2) / 2;
  return { fee, free: false, reason: 'distance_surcharge', distanceKm };
}
