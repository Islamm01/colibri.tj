'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'colibri_splash_seen';
const AUTO_DISMISS_MS = 2200;

export function WelcomeSplash() {
  const [show, setShow] = useState<boolean>(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setShow(true);
        sessionStorage.setItem(STORAGE_KEY, '1');
      }
    } catch {
      // sessionStorage unavailable — skip splash gracefully
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const dismissTimer = setTimeout(() => setExiting(true), AUTO_DISMISS_MS);
    const removeTimer = setTimeout(() => setShow(false), AUTO_DISMISS_MS + 500);
    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(removeTimer);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      onClick={() => {
        setExiting(true);
        setTimeout(() => setShow(false), 400);
      }}
      className={`fixed inset-0 z-[80] flex items-center justify-center transition-opacity duration-500 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        // Deep forest splash — matches the dark app canvas
        background:
          'radial-gradient(ellipse at 50% 42%, #103325 0%, #0C2A1E 55%, #071E15 100%)',
      }}
      role="presentation"
    >
      <div className="flex flex-col items-center px-8">
        <div
          className="animate-logo-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/colibri-mark-white.png"
            alt="Colibri"
            width={200}
            height={200}
            className="select-none"
            draggable={false}
          />
        </div>
      </div>

      <style jsx>{`
        :global(.animate-logo-in) {
          animation: logoIn 1.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes logoIn {
          0% {
            opacity: 0;
            transform: scale(0.88);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
