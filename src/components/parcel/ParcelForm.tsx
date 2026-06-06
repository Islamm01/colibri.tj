'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { normalizePhone, isValidName } from '@/lib/validation';
import { MapPickerModal } from '@/components/checkout/MapPickerModal';
import { AddressAutocomplete, type ResolvedAddress } from '@/components/geo/AddressAutocomplete';
import { quoteParcel, validateParcelDistance } from '@/lib/orders/parcel-pricing';
import type { PaymentMethod } from '@/lib/types';

interface AddressInput {
  formatted_address: string;
  lat: number | null;
  lng: number | null;
  name: string;
  phone: string;
}

const EMPTY: AddressInput = { formatted_address: '', lat: null, lng: null, name: '', phone: '' };

interface Props {
  locale: string;
  initialSenderName: string;
  initialSenderPhone: string;
}

export function ParcelForm({ locale, initialSenderName, initialSenderPhone }: Props) {
  const t = useTranslations('parcel');
  const router = useRouter();

  const [pickup, setPickup] = useState<AddressInput>({ ...EMPTY, name: initialSenderName, phone: initialSenderPhone });
  const [dropoff, setDropoff] = useState<AddressInput>(EMPTY);
  const [description, setDescription] = useState('');
  const [fragile, setFragile] = useState(false);
  const [weight, setWeight] = useState<'light' | 'heavy'>('light');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashPayer, setCashPayer] = useState<'sender' | 'recipient'>('sender');
  const [mapOpen, setMapOpen] = useState<null | 'pickup' | 'dropoff'>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  const pickupSet = pickup.lat != null && pickup.lng != null;
  const dropoffSet = dropoff.lat != null && dropoff.lng != null;
  const bothPinned = pickupSet && dropoffSet;

  const quote = useMemo(() => {
    if (!bothPinned) return null;
    return quoteParcel({
      pickupLat: pickup.lat!, pickupLng: pickup.lng!,
      dropoffLat: dropoff.lat!, dropoffLng: dropoff.lng!,
      weight,
    });
  }, [bothPinned, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, weight]);

  const tooFar = quote ? !validateParcelDistance(quote.distance_km).ok : false;

  async function applyPin(which: 'pickup' | 'dropoff', c: { lat: number; lng: number }) {
    const setter = which === 'pickup' ? setPickup : setDropoff;
    setter((prev) => ({ ...prev, lat: c.lat, lng: c.lng }));
    try {
      const res = await fetch(`/api/geo/reverse?lat=${c.lat}&lng=${c.lng}&locale=${locale}`);
      const data = await res.json();
      setter((prev) => ({
        ...prev,
        formatted_address: data.address || prev.formatted_address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
      }));
    } catch {
      setter((prev) => ({
        ...prev,
        formatted_address: prev.formatted_address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
      }));
    }
  }

  function validate(): string | null {
    if (!pickupSet) return t('errors.invalid_pickup_location');
    if (!isValidName(dropoff.name)) return t('errors.invalid_dropoff_name');
    if (!normalizePhone(dropoff.phone)) return t('errors.invalid_dropoff_phone');
    if (!dropoffSet) return t('errors.invalid_dropoff_location');
    if (tooFar) return t('errors.too_far');
    return null;
  }

  async function submit() {
    setSubmitError(null);
    const err = validate();
    if (err) { setSubmitError(err); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/parcel-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: idempotencyKey.current,
          pickup: {
            formatted_address: pickup.formatted_address, lat: pickup.lat, lng: pickup.lng,
            name: pickup.name || t('senderFallback'),
            phone: normalizePhone(pickup.phone) || normalizePhone(dropoff.phone),
          },
          dropoff: {
            formatted_address: dropoff.formatted_address, lat: dropoff.lat, lng: dropoff.lng,
            name: dropoff.name, phone: dropoff.phone,
          },
          contents_category: 'small',
          contents_description: description || undefined,
          weight,
          payment_method: paymentMethod,
          cash_payer: paymentMethod === 'cash' ? cashPayer : undefined,
          notes: fragile ? t('fragile') : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = data?.error;
        // Show the specific server detail when present (e.g. a DB constraint
        // message) so a misconfigured database is diagnosable instead of a
        // generic "try again". Falls back to a translated message.
        const friendly = t.has(`errors.${key}`) ? t(`errors.${key}`) : t('errors.generic');
        setSubmitError(data?.detail ? `${friendly} (${data.detail})` : friendly);
        return;
      }
      router.push(`/${locale}/track/${data.order.public_code}`);
    } catch {
      setSubmitError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 pb-[150px]">
      <Card>
        <SectionHeader dotColor="bg-fig-700" label={t('pickup.section')} />
        <AddressAutocomplete
          value={{ text: pickup.formatted_address, lat: pickup.lat, lng: pickup.lng }}
          onChange={(v: ResolvedAddress) => setPickup({ ...pickup, formatted_address: v.text, lat: v.lat, lng: v.lng })}
          placeholder={t('pickup.addressPlaceholder')}
          mapLabel={t('chooseOnMap')}
          onOpenMap={() => setMapOpen('pickup')}
          dotColor="bg-fig-700"
        />
        <Divider />
        <PlainInput icon="user" value={pickup.name} onChange={(v) => setPickup({ ...pickup, name: v })} placeholder={t('pickup.namePlaceholder')} />
        <Divider />
        <PlainInput icon="phone" type="tel" value={pickup.phone} onChange={(v) => setPickup({ ...pickup, phone: v })} placeholder={t('pickup.phonePlaceholder')} />
      </Card>

      <div className="mt-4">
        <Card>
          <SectionHeader dotColor="bg-gold-500" label={t('dropoff.section')} />
          <AddressAutocomplete
            value={{ text: dropoff.formatted_address, lat: dropoff.lat, lng: dropoff.lng }}
            onChange={(v: ResolvedAddress) => setDropoff({ ...dropoff, formatted_address: v.text, lat: v.lat, lng: v.lng })}
            placeholder={t('dropoff.addressPlaceholder')}
            mapLabel={t('chooseOnMap')}
            onOpenMap={() => setMapOpen('dropoff')}
            dotColor="bg-gold-500"
          />
          <Divider />
          <PlainInput icon="user" value={dropoff.name} onChange={(v) => setDropoff({ ...dropoff, name: v })} placeholder={t('dropoff.namePlaceholder')} required />
          <Divider />
          <PlainInput icon="phone" type="tel" value={dropoff.phone} onChange={(v) => setDropoff({ ...dropoff, phone: v })} placeholder={t('dropoff.phonePlaceholder')} required />
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <SectionHeader plain label={t('contents.section')} />
          <PlainInput icon="box" value={description} onChange={setDescription} placeholder={t('contents.descPlaceholder')} />
          <Divider />
          <button type="button" onClick={() => setFragile((f) => !f)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100/45 shrink-0">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" />
            </svg>
            <span className="flex-1 text-[14px] text-cream-100">{t('fragile')}</span>
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${fragile ? 'bg-fig-600 border-fig-600' : 'border-black/20'}`}>
              {fragile && (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>)}
            </span>
          </button>
          <Divider />
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="text-[13px] text-cream-100 flex-1">{t('weight.section')}</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setWeight('light')} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${weight === 'light' ? 'bg-gold-300/15 border-fig-600/40 text-gold-300' : 'surface border-gold-300/10 text-cream-100/55'}`}>{t('weight.light')}</button>
              <button type="button" onClick={() => setWeight('heavy')} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${weight === 'heavy' ? 'bg-gold-300/15 border-fig-600/40 text-gold-300' : 'surface border-gold-300/10 text-cream-100/55'}`}>{t('weight.heavy')}</button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <div className="text-[10px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2.5 px-1">{t('payment.section')}</div>
        <div className="space-y-2">
          {(['cash', 'qr', 'bank_transfer'] as PaymentMethod[]).map((method) => {
            const active = paymentMethod === method;
            const label = method === 'cash' ? t('payment.cash') : method === 'qr' ? t('payment.qr') : t('payment.transfer');
            return (
              <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${active ? 'bg-gold-300/15 border-fig-600/40' : 'surface border-gold-300/10'}`}>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-fig-600' : 'border-black/20'}`}>
                  {active && <span className="w-2.5 h-2.5 rounded-full bg-fig-600" />}
                </span>
                <span className="text-[14px] font-medium text-cream-100">{label}</span>
              </button>
            );
          })}
        </div>
        {paymentMethod === 'cash' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCashPayer('sender')} className={`px-3 py-2.5 rounded-lg text-[12.5px] transition-all border ${cashPayer === 'sender' ? 'bg-gold-300/15 border-fig-600/40 text-gold-300 font-medium' : 'surface border-gold-300/10 text-cream-100'}`}>{t('payment.payerSender')}</button>
            <button type="button" onClick={() => setCashPayer('recipient')} className={`px-3 py-2.5 rounded-lg text-[12.5px] transition-all border ${cashPayer === 'recipient' ? 'bg-gold-300/15 border-fig-600/40 text-gold-300 font-medium' : 'surface border-gold-300/10 text-cream-100'}`}>{t('payment.payerRecipient')}</button>
          </div>
        )}
      </div>

      {submitError && (<div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-berry">{submitError}</div>)}

      <div className="fixed bottom-[64px] inset-x-0 z-30 px-4 pb-2 pt-2 bg-gradient-to-t from-cream via-cream/95 to-cream/0 pointer-events-none">
        <div className="max-w-md mx-auto surface rounded-2xl border border-fig-600/[0.15] px-3.5 py-2.5 shadow-card-hover pointer-events-auto">
          {quote && !tooFar ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <div className="text-[19px] font-medium text-cream-100 tabular-nums leading-none">{quote.total} <span className="text-[11px] text-cream-100/55 font-normal">{t('som')}</span></div>
                <div className="text-[10px] text-cream-100/55 mt-1 truncate">{quote.distance_km.toFixed(1)} км · {weight === 'heavy' ? '5–15 кг' : t('weight.light')}</div>
              </div>
              <button type="button" onClick={submit} disabled={submitting} className="flex-1 btn-fig text-white py-2.5 rounded-xl font-medium text-[13.5px] disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting ? (<span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />) : (t('submit'))}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-1.5 text-[12px] text-cream-100/55 text-center">
              {tooFar ? t('errors.too_far') : t('price.pickAddresses')}
            </div>
          )}
        </div>
      </div>

      <MapPickerModal open={mapOpen === 'pickup'} title={t('pickup.mapTitle')} hint={t('mapHint.pickup')} confirmLabel={t('mapConfirm')} initial={pickupSet ? { lat: pickup.lat!, lng: pickup.lng! } : null} onClose={() => setMapOpen(null)} onConfirm={(c) => applyPin('pickup', c)} />
      <MapPickerModal open={mapOpen === 'dropoff'} title={t('dropoff.mapTitle')} hint={t('mapHint.dropoff')} confirmLabel={t('mapConfirm')} initial={dropoffSet ? { lat: dropoff.lat!, lng: dropoff.lng! } : null} onClose={() => setMapOpen(null)} onConfirm={(c) => applyPin('dropoff', c)} />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="surface rounded-2xl border border-gold-300/10 shadow-soft overflow-hidden">{children}</div>;
}
function SectionHeader({ label, dotColor, plain }: { label: string; dotColor?: string; plain?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
      {!plain && dotColor && <div className={`w-3 h-3 rounded-full ${dotColor}`} />}
      <span className={`text-[12px] font-semibold tracking-[1px] uppercase ${plain ? 'text-cream-100/45' : 'text-cream-100'}`}>{label}</span>
    </div>
  );
}
function Divider() { return <div className="h-px bg-black/[0.05] mx-4" />; }
function FieldIcon({ icon }: { icon: 'user' | 'phone' | 'box' }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'text-cream-100/45 shrink-0' };
  if (icon === 'user') return (<svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>);
  if (icon === 'phone') return (<svg {...common}><path d="M3 5a2 2 0 0 1 2-2h3.5l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2V18a2 2 0 0 1-2 2A16 16 0 0 1 3 5Z" /></svg>);
  return (<svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>);
}
function PlainInput({ icon, value, onChange, placeholder, type = 'text', required }: { icon: 'user' | 'phone' | 'box'; value: string; onChange: (v: string) => void; placeholder: string; type?: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <FieldIcon icon={icon} />
      <input type={type} inputMode={type === 'tel' ? 'tel' : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder + (required ? ' *' : '')} className="flex-1 bg-transparent outline-none text-[14px] text-cream-100 placeholder:text-cream-100/35" />
    </div>
  );
}
