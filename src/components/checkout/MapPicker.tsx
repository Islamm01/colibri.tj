'use client';

import { useEffect, useRef } from 'react';

// Khujand center coordinates as a sensible default
const KHUJAND_CENTER: [number, number] = [40.2837, 69.6219];

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  height?: number;
}

export function MapPicker({ value, onChange, height = 240 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      // Inject Leaflet CSS once
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      const startCoords = valueRef.current ?? { lat: KHUJAND_CENTER[0], lng: KHUJAND_CENTER[1] };

      const map = L.map(containerRef.current, {
        center: [startCoords.lat, startCoords.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Custom fig-purple pin
      const pinIcon = L.divIcon({
        className: 'colibri-map-pin',
        html: `
          <div style="position: relative; width: 32px; height: 40px; transform: translateY(-50%);">
            <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24c0-8.84-7.16-16-16-16z" fill="#014737"/>
              <circle cx="16" cy="16" r="6" fill="white"/>
            </svg>
          </div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });

      const marker = L.marker([startCoords.lat, startCoords.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove: () => void } | null;
      if (map) {
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // External value updates (e.g. from GPS) → recenter
  useEffect(() => {
    const map = mapRef.current as { setView: (latlng: [number, number], zoom: number) => void } | null;
    const marker = markerRef.current as { setLatLng: (latlng: [number, number]) => void } | null;
    if (map && marker && value) {
      marker.setLatLng([value.lat, value.lng]);
      map.setView([value.lat, value.lng], 16);
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden border border-gold-300/10 bg-forest-700"
      style={{ height }}
    />
  );
}
