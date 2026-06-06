'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

interface Props {
  courierId: string;
  destLat: number;
  destLng: number;
  height?: number;
}

/**
 * Mini-map showing the courier's live position and the delivery destination.
 * Subscribes to realtime updates on `couriers.last_lat/lng` for instant blue-dot movement.
 */
export function LiveCourierMap({ courierId, destLat, destLng, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const courierMarkerRef = useRef<unknown>(null);
  const destMarkerRef = useRef<unknown>(null);
  const courierIdRef = useRef(courierId);

  // Keep ref current
  useEffect(() => {
    courierIdRef.current = courierId;
  });

  // Initial map setup + load initial courier position from API
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [destLat, destLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Destination pin (purple, like the address picker)
      const destIcon = L.divIcon({
        className: 'colibri-dest-pin',
        html: `
          <svg width="28" height="36" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" style="transform: translateY(-50%);">
            <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24c0-8.84-7.16-16-16-16z" fill="#014737"/>
            <circle cx="16" cy="16" r="6" fill="white"/>
          </svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });
      destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon }).addTo(map);

      // Courier pin (green, with pulse)
      const courierIcon = L.divIcon({
        className: 'colibri-courier-pin',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; inset: -8px; background: rgba(34,197,94,0.25); border-radius: 50%; animation: colibriPulse 1.6s ease-out infinite;"></div>
            <div style="position: absolute; inset: 0; background: #16a34a; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.2);"></div>
          </div>
          <style>
            @keyframes colibriPulse {
              0% { transform: scale(0.8); opacity: 0.6; }
              100% { transform: scale(2); opacity: 0; }
            }
          </style>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Fetch initial courier position via API
      try {
        const supabase = getSupabaseBrowser();
        if (supabase) {
          const { data: courierRow } = await supabase
            .from('couriers')
            .select('last_lat, last_lng')
            .eq('user_id', courierId)
            .maybeSingle();
          if (courierRow?.last_lat && courierRow?.last_lng) {
            const marker = L.marker([courierRow.last_lat, courierRow.last_lng], {
              icon: courierIcon,
            }).addTo(map);
            courierMarkerRef.current = marker;
            // Fit bounds
            const bounds = L.latLngBounds([
              [courierRow.last_lat, courierRow.last_lng],
              [destLat, destLng],
            ]);
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          }
        }
      } catch {
        // Ignore — map still works without courier position
      }

      // Save reference and prepare a function to update marker on realtime
      mapRef.current = map;

      // Subscribe to realtime
      const supabase = getSupabaseBrowser();
      if (supabase) {
        const channel = supabase
          .channel(`courier-pos:${courierId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'couriers',
              filter: `user_id=eq.${courierId}`,
            },
            (payload) => {
              const row = payload.new as { last_lat?: number; last_lng?: number };
              if (row?.last_lat && row?.last_lng) {
                if (courierMarkerRef.current) {
                  (courierMarkerRef.current as { setLatLng: (ll: [number, number]) => void }).setLatLng([
                    row.last_lat,
                    row.last_lng,
                  ]);
                } else {
                  const marker = L.marker([row.last_lat, row.last_lng], { icon: courierIcon }).addTo(map);
                  courierMarkerRef.current = marker;
                }
              }
            },
          )
          .subscribe();

        // Return cleanup that also removes channel
        return () => {
          supabase.removeChannel(channel);
        };
      }
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove: () => void } | null;
      if (map) {
        map.remove();
        mapRef.current = null;
        courierMarkerRef.current = null;
        destMarkerRef.current = null;
      }
    };
  }, [courierId, destLat, destLng]);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden border border-gold-300/10 bg-forest-700"
      style={{ height }}
    />
  );
}
