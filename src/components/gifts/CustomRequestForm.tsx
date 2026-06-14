'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GIFT_OCCASIONS } from '@/lib/categories';

// TODO: phase 2 self-serve gift builder — for now this is a request form that
// lands in the operator queue; an operator composes and prices the set by hand.
export function CustomRequestForm({ locale }: { locale: string }) {
  const t = useTranslations('gifts');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('');
  const [occasion, setOccasion] = useState<string>('holiday');
  const [preferences, setPreferences] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError(t('custom.errorName'));
      return;
    }
    if (phone.replace(/\D/g, '').length < 9) {
      setError(t('custom.errorPhone'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/gift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: name,
          phone,
          budget: budget ? Number(budget) : null,
          occasion,
          preferences,
        }),
      });
      if (!res.ok) {
        setError(t('custom.error'));
        return;
      }
      setDone(true);
    } catch {
      setError(t('custom.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="px-5 pt-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gold-300/15 flex items-center justify-center text-gold-300 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="font-serif text-[20px] text-cream-100">{t('custom.success')}</h2>
        <p className="text-[13px] text-cream-100/55 mt-2 max-w-[280px] mx-auto leading-snug">
          {t('custom.successHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-4">
      <div>
        <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('custom.nameLabel')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('custom.namePlaceholder')}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all"
        />
      </div>

      <div>
        <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('custom.phoneLabel')}</label>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('custom.phonePlaceholder')}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('custom.budgetLabel')}</label>
          <input
            type="number"
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder={t('custom.budgetPlaceholder')}
            className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all"
          />
        </div>
        <div>
          <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('custom.occasionLabel')}</label>
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all"
          >
            {GIFT_OCCASIONS.map((o) => (
              <option key={o.key} value={o.key} className="bg-forest-800">
                {locale === 'ru' ? o.ru : o.tj}
              </option>
            ))}
            <option value="other" className="bg-forest-800">{t('custom.occasionOther')}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[12px] text-cream-100/60 mb-1.5">{t('custom.preferencesLabel')}</label>
        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder={t('custom.preferencesPlaceholder')}
          rows={4}
          className="w-full px-4 py-3 rounded-xl surface text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-gold-300/30 transition-all resize-none"
        />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50/10 border border-berry/30 rounded-xl text-[12px] text-berry">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full btn-gold py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.99] transition-transform"
      >
        {submitting ? t('custom.submitting') : t('custom.submit')}
      </button>
    </div>
  );
}
