'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  locale: string;
  defaultContactName: string;
  defaultPhone: string;
}

export function PartnerForm({ locale, defaultContactName, defaultPhone }: Props) {
  const t = useTranslations('partner');

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState(defaultContactName);
  const [phone, setPhone] = useState(defaultPhone);
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setSubmitError(null);
    if (businessName.trim().length < 2) {
      setSubmitError(t('errors.invalid_business_name'));
      return;
    }
    if (contactName.trim().length < 2) {
      setSubmitError(t('errors.invalid_contact_name'));
      return;
    }
    if (!phone.trim()) {
      setSubmitError(t('errors.invalid_phone'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/partner-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          contact_name: contactName,
          phone,
          address: address || undefined,
          vertical: 'fruits', // single direction: Fruits & Dried Fruits (incl. nuts)
          category: category || undefined,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : t('errors.generic'));
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-8 surface rounded-2xl border border-green-100 p-7 text-center animate-fade-up">
        <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center text-gold-300 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="font-serif text-[20px] text-cream-100 mb-2">{t('success.title')}</h2>
        <p className="text-[13px] text-cream-100/55 leading-relaxed">{t('success.hint')}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <Section title={t('businessSection')}>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder={t('businessNamePlaceholder')}
          className="form-input"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t('categoryPlaceholder')}
          className="form-input mt-3"
        />
      </Section>

      <Section title={t('contactSection')}>
        <input
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder={t('contactNamePlaceholder')}
          className="form-input"
        />
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+992 90 000 00 00"
          className="form-input mt-2"
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('addressPlaceholder')}
          className="form-input mt-2"
        />
      </Section>

      <Section title={t('aboutSection')}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t('aboutPlaceholder')}
          className="form-input resize-none"
        />
      </Section>

      {submitError && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-berry">
          {submitError}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full btn-fig text-white py-3.5 rounded-xl font-medium text-[15px] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t('submitting')}
          </>
        ) : (
          t('submit')
        )}
      </button>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          padding: 0.75rem 0.875rem;
          border-radius: 0.625rem;
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-size: 14px;
          background: white;
          color: rgb(31, 13, 23);
        }
        :global(.form-input::placeholder) {
          color: rgba(0, 0, 0, 0.35);
        }
        :global(.form-input:focus) {
          outline: none;
          border-color: rgba(37, 55, 69, 0.4);
          box-shadow: 0 0 0 3px rgba(37, 55, 69, 0.12);
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[10px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2.5 px-1">
        {title}
      </h2>
      {children}
    </section>
  );
}
