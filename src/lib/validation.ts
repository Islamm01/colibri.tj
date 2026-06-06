// =====================================================================
// Phone number normalization for Tajikistan
//
// Tajik mobile numbers are 9 digits after country code +992.
// Common formats users type:
//   +992 92 123 45 67
//   992921234567
//   92 123 45 67
//   921234567
// Canonical form we store: +992921234567
// =====================================================================

export function normalizePhone(input: string): string | null {
  if (!input) return null;

  // Strip all non-digits except leading +
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  // If 9 digits, assume Tajik mobile without country code
  if (digits.length === 9) return `+992${digits}`;
  // If 12 digits starting with 992
  if (digits.length === 12 && digits.startsWith('992')) return `+${digits}`;
  // If 11 digits starting with 992 (someone typed 11 digits, treat as +992XXXXXXXX)
  if (digits.length === 11 && digits.startsWith('992')) return `+${digits}`;

  return null; // Invalid format
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

export function isValidName(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function isValidLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
