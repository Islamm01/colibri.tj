'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { normalizePhone, isValidName } from '@/lib/validation';

const VEHICLES = [
  { value: 'moto', icon: '🛵' },
  { value: 'bike', icon: '🚲' },
  { value: 'car', icon: '🚗' },
  { value: 'foot', icon: '🚶' },
];

export function CourierApplyClient({ locale }: { locale: string }) {
  const t = useTranslations('courierApply');
  const [step, setStep] = useState<'conditions' | 'form' | 'done'>('conditions');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('moto');
  const [district, setDistrict] = useState('');
  const [about, setAbout] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conditions = [
    { icon: '💰', key: 'earnings' },
    { icon: '🕒', key: 'flexible' },
    { icon: '📱', key: 'phone' },
    { icon: '🛵', key: 'vehicle' },
    { icon: '⚡', key: 'fast' },
    { icon: '🤝', key: 'fair' },
  ];

  async function submit() {
    setError(null);
    if (!isValidName(fullName)) { setError(t('errors.invalid_name')); return; }
    if (!normalizePhone(phone)) { setError(t('errors.invalid_phone')); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/courier-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName, phone, vehicle,
          district: district || undefined, about: about || undefined,
          accepted_terms: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : t('errors.generic'));
        return;
      }
      setStep('done');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-green-100 p-7 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center text-green-700 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 className="font-serif text-[20px] text-ink-soft mb-2">{t('done.title')}</h2>
        <p className="text-[13px] text-ink-muted leading-relaxed">{t('done.hint')}</p>
      </div>
    );
  }

  if (step === 'conditions') {
    return (
      <div className="mt-5">
        <h2 className="text-[11px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-3 px-1">{t('conditionsTitle')}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {conditions.map((c) => (
            <div key={c.key} className="bg-white rounded-2xl border border-black/[0.05] p-3.5 shadow-soft">
              <div className="text-[22px] mb-1.5">{c.icon}</div>
              <div className="text-[13px] font-medium text-ink-soft leading-tight">{t(`conditions.${c.key}.title`)}</div>
              <div className="text-[11px] text-ink-muted leading-snug mt-1">{t(`conditions.${c.key}.hint`)}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-gold-50 border border-gold-200 rounded-2xl p-4">
          <p className="text-[12.5px] text-ink-soft leading-relaxed">{t('requirementsNote')}</p>
        </div>

        <button
          onClick={() => setStep('form')}
          className="mt-5 w-full btn-fig text-white py-3.5 rounded-xl font-medium text-[15px]"
        >
          {t('readyButton')}
        </button>
      </div>
    );
  }

  // form step
  return (
    <div className="mt-5 space-y-4">
      <button onClick={() => setStep('conditions')} className="text-[12px] text-ink-muted hover:text-fig-700 inline-flex items-center gap-1">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        {t('backToConditions')}
      </button>

      <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft p-4 space-y-3">
        <Field label={t('form.name')} value={fullName} onChange={setFullName} placeholder={t('form.namePlaceholder')} />
        <Field label={t('form.phone')} value={phone} onChange={setPhone} placeholder="+992 90 000 00 00" type="tel" />

        <div>
          <label className="text-[11px] text-ink-subtle mb-1.5 px-0.5 block">{t('form.vehicle')}</label>
          <div className="grid grid-cols-4 gap-2">
            {VEHICLES.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setVehicle(v.value)}
                className={`px-2 py-2.5 rounded-xl text-[11px] font-medium border transition-all ${vehicle === v.value ? 'bg-fig-50 border-fig-600/40 text-fig-700' : 'bg-white border-black/[0.06] text-ink-soft'}`}
              >
                <div className="text-[18px] mb-0.5">{v.icon}</div>
                {t(`form.vehicles.${v.value}`)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('form.district')} value={district} onChange={setDistrict} placeholder={t('form.districtPlaceholder')} />
        <div>
          <label className="text-[11px] text-ink-subtle mb-1.5 px-0.5 block">{t('form.about')}</label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={3}
            placeholder={t('form.aboutPlaceholder')}
            className="w-full px-3 py-2.5 rounded-lg border border-black/[0.1] text-[13.5px] text-ink-soft placeholder:text-ink-faint focus:outline-none focus:border-fig-600/40 resize-none"
          />
        </div>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{error}</div>}

      <button onClick={submit} disabled={submitting} className="w-full btn-fig text-white py-3.5 rounded-xl font-medium text-[15px] disabled:opacity-60 flex items-center justify-center gap-2">
        {submitting ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('form.submit')}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[11px] text-ink-subtle mb-1.5 px-0.5 block">{label}</label>
      <input
        type={type}
        inputMode={type === 'tel' ? 'tel' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border border-black/[0.1] text-[14px] text-ink-soft placeholder:text-ink-faint focus:outline-none focus:border-fig-600/40"
      />
    </div>
  );
}
