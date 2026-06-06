'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !password) {
      setError('Заполните все поля');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error === 'invalid_credentials' ? 'Неверный номер или пароль' : 'Ошибка входа');
        return;
      }
      // Force a full reload so the layout server components re-read the session
      const dest =
        data.role === 'store_owner'
          ? '/staff/store'
          : data.role === 'operator'
          ? '/staff/operator'
          : data.role === 'courier'
          ? '/staff/courier'
          : '/staff';
      window.location.assign(dest);
    } catch {
      setError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-[11px] font-medium text-ink-muted block mb-1.5">
          Номер телефона
        </label>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+992 90 000 00 00"
          className="w-full px-4 py-3 rounded-lg border border-black/[0.1] text-[15px] focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40"
        />
      </div>
      <div>
        <label className="text-[11px] font-medium text-ink-muted block mb-1.5">
          Пароль
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-black/[0.1] text-[15px] focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40"
        />
      </div>
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full btn-fig text-white py-3 rounded-lg font-medium text-[14px] disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Вход...
          </>
        ) : (
          'Войти'
        )}
      </button>
    </form>
  );
}
