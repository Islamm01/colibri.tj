'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="flex-1 bg-forest-700 animate-pulse" />,
});

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  hint?: string;
  initial: { lat: number; lng: number } | null;
  onClose: () => void;
  onConfirm: (coords: { lat: number; lng: number }) => void;
}

/**
 * Full-screen map modal, rendered through a portal to document.body.
 *
 * Why a portal: the customer/parcel pages live inside a `max-w-md relative`
 * container (with a `grain` overlay) which creates its own stacking context.
 * A modal rendered inside that tree competes with sibling sticky bars and the
 * payment section, which is why those were bleeding on top of the map. By
 * portaling to <body> the modal escapes that context entirely and a single
 * high z-index reliably covers everything.
 */
export function MapPickerModal({
  open,
  title,
  confirmLabel,
  hint,
  initial,
  onClose,
  onConfirm,
}: Props) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(initial);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setPicked(initial);
  }, [open, initial]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open || !mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[2000] bg-cream flex flex-col animate-fade-in">
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-gold-300/10 surface">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-cream-100">{title}</div>
          {hint && <div className="text-[11px] text-cream-100/55 mt-0.5">{hint}</div>}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 shrink-0"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 relative">
        <MapPicker
          value={picked}
          onChange={(c) => setPicked(c)}
          height={typeof window !== 'undefined' ? window.innerHeight - 150 : 500}
        />
        {!picked && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-fig-800/90 text-white text-[12px] px-3 py-1.5 rounded-full shadow-card pointer-events-none">
            Нажмите на карту, чтобы поставить точку
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-gold-300/10 surface safe-bottom">
        <button
          onClick={() => {
            if (picked) {
              onConfirm(picked);
              onClose();
            }
          }}
          disabled={!picked}
          className="w-full btn-fig text-white py-3.5 rounded-xl font-medium text-[15px] disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
