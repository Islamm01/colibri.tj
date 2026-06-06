// =====================================================================
// Colibri — Geocoding (address autocomplete + reverse geocode)
//
// Provider-agnostic. Reads which provider to use from env:
//   GEOCODER_PROVIDER = 'yandex' | '2gis' | 'osm'  (default: 'osm')
//   YANDEX_GEOCODER_KEY = <key>   (required if provider = yandex)
//   TWOGIS_KEY = <key>            (required if provider = 2gis)
//
// Until you register a Yandex/2GIS key, it falls back to OpenStreetMap
// (Nominatim) which is free and needs no key — coverage of Khujand house
// numbers is patchy but streets work, and the moment you add a key the
// experience upgrades with zero code changes.
//
// All functions are server-side only (called from /api routes) so keys
// never reach the browser and we control rate limiting.
// =====================================================================

export interface GeoSuggestion {
  /** Full formatted address shown to the user. */
  label: string;
  /** Shorter primary line (street + house). */
  primary: string;
  /** Secondary line (district, city). */
  secondary: string;
  lat: number;
  lng: number;
}

// Bias all searches toward Khujand so "Ленина" returns the Khujand street,
// not one in Moscow.
const KHUJAND = { lat: 40.2837, lng: 69.6219 };
const KHUJAND_VIEWBOX = {
  // rough bounding box around Khujand + Bobojon Ghafurov district
  minLng: 69.4,
  minLat: 40.15,
  maxLng: 69.85,
  maxLat: 40.42,
};

function provider(): 'yandex' | '2gis' | 'osm' {
  const p = (process.env.GEOCODER_PROVIDER ?? '').toLowerCase();
  if (p === 'yandex' && process.env.YANDEX_GEOCODER_KEY) return 'yandex';
  if (p === '2gis' && process.env.TWOGIS_KEY) return '2gis';
  return 'osm';
}

// ---------------------------------------------------------------------
// FORWARD: text query -> address suggestions (autocomplete)
// ---------------------------------------------------------------------
export async function searchAddresses(query: string, locale = 'ru'): Promise<GeoSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    switch (provider()) {
      case 'yandex':
        return await yandexSearch(q, locale);
      case '2gis':
        return await twogisSearch(q);
      default:
        return await osmSearch(q, locale);
    }
  } catch (err) {
    console.error('[geocode] search failed', err);
    return [];
  }
}

// ---------------------------------------------------------------------
// REVERSE: coordinates -> formatted address
// ---------------------------------------------------------------------
export async function reverseGeocode(lat: number, lng: number, locale = 'ru'): Promise<string | null> {
  try {
    switch (provider()) {
      case 'yandex':
        return await yandexReverse(lat, lng, locale);
      case '2gis':
        return await twogisReverse(lat, lng);
      default:
        return await osmReverse(lat, lng, locale);
    }
  } catch (err) {
    console.error('[geocode] reverse failed', err);
    return null;
  }
}

// ===================== Yandex =====================
// Yandex Geocoder HTTP API. Best Tajikistan coverage.
async function yandexSearch(q: string, locale: string): Promise<GeoSuggestion[]> {
  const key = process.env.YANDEX_GEOCODER_KEY!;
  const url = new URL('https://geocode-maps.yandex.ru/1.x/');
  url.searchParams.set('apikey', key);
  url.searchParams.set('geocode', `Худжанд, ${q}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('results', '6');
  url.searchParams.set('lang', locale === 'tj' ? 'ru_RU' : 'ru_RU');
  url.searchParams.set(
    'bbox',
    `${KHUJAND_VIEWBOX.minLng},${KHUJAND_VIEWBOX.minLat}~${KHUJAND_VIEWBOX.maxLng},${KHUJAND_VIEWBOX.maxLat}`,
  );
  url.searchParams.set('rspn', '1');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const data = await res.json();
  const members = data?.response?.GeoObjectCollection?.featureMember ?? [];
  return members.map((m: Record<string, unknown>): GeoSuggestion => {
    const obj = m.GeoObject as Record<string, unknown>;
    const meta = (obj.metaDataProperty as Record<string, unknown>)?.GeocoderMetaData as Record<string, unknown>;
    const pos = String((obj.Point as Record<string, unknown>)?.pos ?? '0 0');
    const [lng, lat] = pos.split(' ').map(Number);
    const text = String(meta?.text ?? obj.name ?? '');
    return {
      label: text,
      primary: String(obj.name ?? text),
      secondary: String(obj.description ?? ''),
      lat,
      lng,
    };
  });
}

async function yandexReverse(lat: number, lng: number, locale: string): Promise<string | null> {
  const key = process.env.YANDEX_GEOCODER_KEY!;
  const url = new URL('https://geocode-maps.yandex.ru/1.x/');
  url.searchParams.set('apikey', key);
  url.searchParams.set('geocode', `${lng},${lat}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('results', '1');
  url.searchParams.set('lang', 'ru_RU');
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = await res.json();
  const obj = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const meta = obj?.metaDataProperty?.GeocoderMetaData;
  return meta?.text ?? obj?.name ?? null;
}

// ===================== 2GIS =====================
async function twogisSearch(q: string): Promise<GeoSuggestion[]> {
  const key = process.env.TWOGIS_KEY!;
  const url = new URL('https://catalog.api.2gis.com/3.0/items/geocode');
  url.searchParams.set('q', `Худжанд, ${q}`);
  url.searchParams.set('fields', 'items.point,items.full_name,items.address');
  url.searchParams.set('key', key);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const data = await res.json();
  const items = data?.result?.items ?? [];
  return items
    .filter((it: Record<string, unknown>) => it.point)
    .map((it: Record<string, unknown>): GeoSuggestion => {
      const point = it.point as { lat: number; lon: number };
      return {
        label: String(it.full_name ?? it.name ?? ''),
        primary: String(it.name ?? ''),
        secondary: String((it.address as Record<string, unknown>)?.name ?? ''),
        lat: point.lat,
        lng: point.lon,
      };
    });
}

async function twogisReverse(lat: number, lng: number): Promise<string | null> {
  const key = process.env.TWOGIS_KEY!;
  const url = new URL('https://catalog.api.2gis.com/3.0/items/geocode');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('fields', 'items.full_name');
  url.searchParams.set('key', key);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.result?.items?.[0]?.full_name ?? null;
}

// ===================== OpenStreetMap (Nominatim) — free fallback =====================
async function osmSearch(q: string, locale: string): Promise<GeoSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${q}, Khujand, Tajikistan`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', locale === 'tj' ? 'tg,ru' : 'ru');
  url.searchParams.set(
    'viewbox',
    `${KHUJAND_VIEWBOX.minLng},${KHUJAND_VIEWBOX.maxLat},${KHUJAND_VIEWBOX.maxLng},${KHUJAND_VIEWBOX.minLat}`,
  );
  url.searchParams.set('bounded', '1');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Colibri/1.0 (delivery app; contact@colibri.tj)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data ?? []).map((it: Record<string, unknown>): GeoSuggestion => {
    const addr = (it.address ?? {}) as Record<string, string>;
    const street = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? '';
    const house = addr.house_number ?? '';
    const primary = [street, house].filter(Boolean).join(', ') || String(it.name ?? '');
    const secondary = [addr.suburb, addr.city ?? addr.town].filter(Boolean).join(', ');
    return {
      label: String(it.display_name ?? ''),
      primary: primary || String(it.display_name ?? '').split(',')[0],
      secondary,
      lat: Number(it.lat),
      lng: Number(it.lon),
    };
  });
}

async function osmReverse(lat: number, lng: number, locale: string): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', locale === 'tj' ? 'tg,ru' : 'ru');
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Colibri/1.0 (delivery app; contact@colibri.tj)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const addr = (data?.address ?? {}) as Record<string, string>;
  const street = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? '';
  const house = addr.house_number ?? '';
  const line = [street, house].filter(Boolean).join(', ');
  return line || data?.display_name || null;
}

export { KHUJAND };
