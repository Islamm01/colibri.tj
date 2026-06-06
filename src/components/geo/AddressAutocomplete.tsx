'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';

export interface ResolvedAddress {
  text: string;
  lat: number | null;
  lng: number | null;
}

interface Suggestion {
  label: string;
  primary: string;
  secondary: string;
  lat: number;
  lng: number;
}

interface Props {
  value: ResolvedAddress;
  onChange: (v: ResolvedAddress) => void;
  placeholder: string;
  mapLabel: string;
  onOpenMap: () => void;
  /** aubergine dot for pickup, gold for dropoff */
  dotColor?: string;
}

/**
 * Yandex-style address field:
 *   - Type and get live suggestions from the geocoder (street + house).
 *   - Pick a suggestion -> fills text AND coordinates (so pricing can compute).
 *   - Or tap the map button on the right to drop a pin instead.
 *
 * The suggestions come from /api/geo/search which uses whatever provider is
 * configured (Yandex/2GIS when a key is set, OSM otherwise).
 */
export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  mapLabel,
  onOpenMap,
  dotColor = 'bg-fig-700',
}: Props) {
  const locale = useLocale();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justPickedRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search as the user types
  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    const q = value.text.trim();
    if (q.length < 2 || !focused) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}&locale=${locale}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value.text, locale, focused]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function pick(s: Suggestion) {
    justPickedRef.current = true;
    onChange({ text: s.primary || s.label, lat: s.lat, lng: s.lng });
    setOpen(false);
    setSuggestions([]);
  }

  const filled = value.lat != null && value.lng != null;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
        <input
          type="text"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value, lat: null, lng: null })}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[14px] text-cream-100 placeholder:text-cream-100/35 min-w-0"
        />
        {filled && (
          <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        )}
        {/* Map button — clean icon + label on the right */}
        <button
          type="button"
          onClick={onOpenMap}
          className="flex items-center gap-1 shrink-0 text-gold-300 hover:text-cream-100 pl-1"
          aria-label={mapLabel}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
            <path d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0Z" />
          </svg>
          <span className="text-[11px] font-medium hidden xs:inline">{mapLabel}</span>
        </button>
      </div>

      {/* Suggestions dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 surface rounded-xl border border-gold-300/10 shadow-card-hover overflow-hidden max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-[12px] text-cream-100/55">Поиск...</div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-gold-300/15 border-b border-gold-300/10 last:border-0 flex items-start gap-2.5"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100/35 shrink-0 mt-0.5">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div className="min-w-0">
                <div className="text-[13.5px] text-cream-100 truncate">{s.primary}</div>
                {s.secondary && (
                  <div className="text-[11px] text-cream-100/55 truncate">{s.secondary}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
