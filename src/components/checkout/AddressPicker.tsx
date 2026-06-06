'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AddressAutocomplete, type ResolvedAddress } from '@/components/geo/AddressAutocomplete';
import { MapPickerModal } from './MapPickerModal';

export interface AddressValue {
  formatted_address: string;
  details: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  errors?: { coords?: string; text?: string };
}

/**
 * Address picker for fruit checkout — now matches the parcel flow:
 *   1. Type the street → live suggestions (street + house) that fill coords
 *      (so we know exactly where to deliver), OR tap the map button to pin.
 *   2. One detail field — apartment / floor / intercom.
 *
 * Same AddressAutocomplete + MapPickerModal used in the parcel form, so the
 * two flows feel identical and both produce real coordinates.
 */
export function AddressPicker({ value, onChange, errors }: Props) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const [mapOpen, setMapOpen] = useState(false);

  // Reverse-geocode a dropped pin into a readable address
  async function applyPin(c: { lat: number; lng: number }) {
    onChange({ ...value, lat: c.lat, lng: c.lng });
    try {
      const res = await fetch(`/api/geo/reverse?lat=${c.lat}&lng=${c.lng}&locale=${locale}`);
      const data = await res.json();
      onChange({
        ...value,
        lat: c.lat,
        lng: c.lng,
        formatted_address: data.address || value.formatted_address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
      });
    } catch {
      onChange({
        ...value,
        lat: c.lat,
        lng: c.lng,
        formatted_address: value.formatted_address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
      });
    }
  }

  return (
    <div className="space-y-3">
      {/* Autocomplete address field with map button */}
      <div className="surface rounded-2xl border border-gold-300/10 overflow-hidden">
        <AddressAutocomplete
          value={{ text: value.formatted_address, lat: value.lat, lng: value.lng }}
          onChange={(v: ResolvedAddress) =>
            onChange({ ...value, formatted_address: v.text, lat: v.lat, lng: v.lng })
          }
          placeholder={t('addressPlaceholder')}
          mapLabel={t('chooseOnMap')}
          onOpenMap={() => setMapOpen(true)}
          dotColor="bg-fig-700"
        />
      </div>
      {errors?.coords && <p className="text-[11px] text-berry px-1">{errors.coords}</p>}

      {/* Apartment / floor / intercom */}
      <div>
        <label className="text-[11px] text-cream-100/45 mb-1.5 px-1 block">{t('addressDetails')}</label>
        <input
          type="text"
          value={value.details}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
          placeholder={t('addressDetailsPlaceholder')}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40 transition-all"
        />
        {errors?.text && <p className="text-[11px] text-berry mt-1.5 px-1">{errors.text}</p>}
      </div>

      <MapPickerModal
        open={mapOpen}
        title={t('mapTitle')}
        confirmLabel={t('mapConfirm')}
        initial={value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null}
        onClose={() => setMapOpen(false)}
        onConfirm={(c) => applyPin(c)}
      />
    </div>
  );
}
