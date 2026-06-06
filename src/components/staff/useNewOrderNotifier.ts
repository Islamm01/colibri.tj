'use client';

import { useEffect, useRef, useState } from 'react';

// Procedurally generated beep using Web Audio API (no audio file needed).
function playBeep(audioCtx: AudioContext) {
  // Three-tone "ding" — pleasant, attention-getting, not jarring
  const tones = [
    { freq: 880, duration: 0.12, delay: 0 },
    { freq: 1175, duration: 0.12, delay: 0.13 },
    { freq: 1480, duration: 0.18, delay: 0.27 },
  ];
  for (const t of tones) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = t.freq;
    const startTime = audioCtx.currentTime + t.delay;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + t.duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + t.duration);
  }
}

function flashTitle(originalTitle: string, count: number) {
  let alternate = false;
  const interval = setInterval(() => {
    document.title = alternate ? originalTitle : `🔔 (${count}) Новые заказы — Colibri`;
    alternate = !alternate;
  }, 1000);
  // Stop flashing once user focuses tab
  function stopOnFocus() {
    clearInterval(interval);
    document.title = originalTitle;
    window.removeEventListener('focus', stopOnFocus);
  }
  window.addEventListener('focus', stopOnFocus);
  // Auto-stop after 30s regardless
  setTimeout(() => {
    clearInterval(interval);
    document.title = originalTitle;
    window.removeEventListener('focus', stopOnFocus);
  }, 30000);
}

export interface NotifierState {
  audioEnabled: boolean;
  enableAudio: () => Promise<void>;
  notifyNewOrders: (count: number) => void;
}

export function useNewOrderNotifier(): NotifierState {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const originalTitleRef = useRef('');

  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  async function enableAudio() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      // Resume in case it's in suspended state
      if (ctx.state === 'suspended') await ctx.resume();
      audioCtxRef.current = ctx;
      // Play a tiny test sound (mostly silent) to fully unlock
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      const osc = ctx.createOscillator();
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      setAudioEnabled(true);
      try { localStorage.setItem('colibri_audio_enabled', '1'); } catch {}
    } catch {
      // Audio not supported — silently degrade to title flash only
      setAudioEnabled(false);
    }
  }

  function notifyNewOrders(count: number) {
    if (audioCtxRef.current) {
      try {
        playBeep(audioCtxRef.current);
      } catch {
        // ignore
      }
    }
    if (typeof document !== 'undefined' && document.hidden) {
      flashTitle(originalTitleRef.current, count);
    }
  }

  return { audioEnabled, enableAudio, notifyNewOrders };
}
