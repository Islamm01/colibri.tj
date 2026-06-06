'use client';

import { useEffect, useState } from 'react';
import type { OpeningHours, Store } from '@/lib/types';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Понедельник' },
  { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' },
  { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' },
  { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
];

const DEFAULT_HOURS: OpeningHours = {
  mon: ['08:00', '22:00'],
  tue: ['08:00', '22:00'],
  wed: ['08:00', '22:00'],
  thu: ['08:00', '22:00'],
  fri: ['08:00', '22:00'],
  sat: ['09:00', '22:00'],
  sun: ['09:00', '21:00'],
};

export function HoursEditor() {
  const [store, setStore] = useState<Store | null>(null);
  const [hours, setHours] = useState<OpeningHours>({});
  const [paused, setPaused] = useState(false);
  const [prepTime, setPrepTime] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/store');
      const data = await res.json();
      if (data.store) {
        setStore(data.store);
        setHours(data.store.opening_hours ?? DEFAULT_HOURS);
        setPaused(data.store.is_paused ?? false);
        setPrepTime(data.store.prep_time_minutes ?? 10);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateDay(day: DayKey, value: [string, string] | null) {
    const next: OpeningHours = { ...hours };
    if (value === null) {
      delete next[day];
    } else {
      next[day] = value;
    }
    setHours(next);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/staff/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_hours: hours,
          is_paused: paused,
          prep_time_minutes: prepTime,
        }),
      });
      if (res.ok) {
        setSavedAt(new Date());
        setTimeout(() => setSavedAt(null), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePauseImmediate() {
    const next = !paused;
    setPaused(next);
    await fetch('/api/staff/store', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paused: next }),
    });
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-5">Часы и статус</h1>

      {/* Emergency pause — most important control */}
      <div className={`rounded-2xl p-5 mb-5 border ${paused ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-ink-soft">
              {paused ? 'Магазин на паузе' : 'Магазин принимает заказы'}
            </div>
            <div className="text-[12px] text-ink-muted mt-1 leading-snug">
              {paused
                ? 'Покупатели не видят ваши товары и не могут оформить заказ. Нажмите чтобы возобновить.'
                : 'Срочно нужно закрыться (нет товара, пересменка)? Нажмите паузу — магазин скроется до следующего нажатия.'}
            </div>
          </div>
          <button
            onClick={togglePauseImmediate}
            className={`shrink-0 px-4 py-2.5 rounded-lg font-medium text-[13px] transition-all ${
              paused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {paused ? 'Возобновить' : 'Пауза'}
          </button>
        </div>
      </div>

      {/* Prep time */}
      <div className="bg-white border border-black/[0.06] rounded-2xl p-5 mb-5">
        <div className="text-[15px] font-medium text-ink-soft mb-1">Время приготовления</div>
        <div className="text-[12px] text-ink-muted mb-3 leading-snug">
          Сколько минут вам обычно нужно на сборку заказа. Покупатель видит это в ожидаемом времени доставки.
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrepTime(Math.max(5, prepTime - 5))}
            className="w-9 h-9 rounded-lg border border-black/[0.1] hover:bg-black/[0.03] flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <div className="flex-1 text-center text-[18px] font-medium tabular-nums">
            {prepTime} <span className="text-[13px] text-ink-muted font-normal">мин</span>
          </div>
          <button
            onClick={() => setPrepTime(Math.min(60, prepTime + 5))}
            className="w-9 h-9 rounded-lg border border-black/[0.1] hover:bg-black/[0.03] flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Opening hours */}
      <div className="bg-white border border-black/[0.06] rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-black/[0.04]">
          <div className="text-[15px] font-medium text-ink-soft">Часы работы</div>
          <div className="text-[12px] text-ink-muted mt-0.5">
            Магазин автоматически закрывается вне этих часов
          </div>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {DAYS.map(({ key, label }) => {
            const dayHours = hours[key];
            const isOpen = !!dayHours;
            return (
              <div key={key} className="flex items-center gap-3 px-5 py-3">
                <div className="w-24 text-[13px] text-ink-soft shrink-0">{label}</div>
                <div className="flex-1 flex items-center gap-2">
                  {isOpen ? (
                    <>
                      <input
                        type="time"
                        value={dayHours[0]}
                        onChange={(e) => updateDay(key, [e.target.value, dayHours[1]])}
                        className="px-2 py-1.5 rounded-md border border-black/[0.1] text-[13px] tabular-nums"
                      />
                      <span className="text-ink-faint">—</span>
                      <input
                        type="time"
                        value={dayHours[1]}
                        onChange={(e) => updateDay(key, [dayHours[0], e.target.value])}
                        className="px-2 py-1.5 rounded-md border border-black/[0.1] text-[13px] tabular-nums"
                      />
                    </>
                  ) : (
                    <span className="text-[12px] text-ink-muted">Выходной</span>
                  )}
                </div>
                <button
                  onClick={() => updateDay(key, isOpen ? null : ['08:00', '22:00'])}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                    isOpen ? 'text-ink-muted hover:bg-black/[0.04]' : 'text-fig-700 hover:bg-fig-50'
                  }`}
                >
                  {isOpen ? 'Выходной' : 'Открыт'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg btn-fig text-white font-medium text-[13px] disabled:opacity-70"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {savedAt && (
          <span className="text-[12px] text-green-700 animate-fade-in">✓ Сохранено</span>
        )}
      </div>
    </div>
  );
}
