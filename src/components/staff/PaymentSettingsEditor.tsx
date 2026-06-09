'use client';

import { useEffect, useState } from 'react';
import { ImageCropUploader } from '@/components/images/ImageCropUploader';

interface Settings {
  qr_enabled: boolean;
  qr_image_url: string | null;
  qr_label: string | null;
  transfer_enabled: boolean;
  card_number: string | null;
  card_holder: string | null;
  bank_name: string | null;
  transfer_note: string | null;
  cash_enabled: boolean;
}

const EMPTY: Settings = {
  qr_enabled: true, qr_image_url: null, qr_label: null,
  transfer_enabled: true, card_number: null, card_holder: null, bank_name: null, transfer_note: null,
  cash_enabled: true,
};

export function PaymentSettingsEditor() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [qrUpload, setQrUpload] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/payment-settings');
        const data = await res.json();
        setS({ ...EMPTY, ...(data.settings ?? {}) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/payment-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="px-5 lg:px-7 py-6 text-ink-muted text-[13px]">Загрузка...</div>;

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Настройки оплаты</h1>
      <p className="text-[13px] text-ink-muted mb-5">
        Эти данные видят клиенты при оплате. QR и реквизиты — ваши, банка Colibri.
      </p>

      <div className="space-y-4">
        {/* Cash */}
        <Card>
          <Toggle label="Наличные курьеру" checked={s.cash_enabled} onChange={(v) => set('cash_enabled', v)} />
        </Card>

        {/* QR */}
        <Card>
          <Toggle label="QR-оплата" checked={s.qr_enabled} onChange={(v) => set('qr_enabled', v)} />
          {s.qr_enabled && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                {s.qr_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.qr_image_url} alt="QR" className="w-24 h-24 object-contain rounded-lg border border-black/10 bg-white p-1" />
                ) : (
                  <div className="w-24 h-24 rounded-lg border border-dashed border-black/15 flex items-center justify-center text-[10px] text-ink-faint text-center px-2">
                    Нет QR
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQrUpload(true)}
                      className="px-3 py-2 rounded-lg btn-fig text-white text-[12.5px] font-medium"
                    >
                      {s.qr_image_url ? 'Заменить QR' : 'Загрузить QR'}
                    </button>
                    {s.qr_image_url && (
                      <button
                        type="button"
                        onClick={() => set('qr_image_url', '')}
                        className="px-3 py-2 rounded-lg border border-black/[0.1] text-ink-muted text-[12.5px] font-medium hover:bg-black/[0.03]"
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-faint mt-1.5 px-0.5">
                    Загрузите файл QR прямо с устройства — ссылка не нужна.
                  </p>
                </div>
              </div>
              <Field
                label="Ссылка на изображение QR (необязательно)"
                value={s.qr_image_url}
                onChange={(v) => set('qr_image_url', v)}
                placeholder="https://..."
              />
              <Field label="Подпись под QR" value={s.qr_label} onChange={(v) => set('qr_label', v)} placeholder="Отсканируйте QR в приложении банка" />
            </div>
          )}
        </Card>

        {/* Transfer */}
        <Card>
          <Toggle label="Перевод по номеру / карте" checked={s.transfer_enabled} onChange={(v) => set('transfer_enabled', v)} />
          {s.transfer_enabled && (
            <div className="mt-3 space-y-2.5">
              <Field label="Банк" value={s.bank_name} onChange={(v) => set('bank_name', v)} placeholder="Алиф Банк" />
              <Field label="Номер карты / счёта" value={s.card_number} onChange={(v) => set('card_number', v)} placeholder="0000 0000 0000 0000" mono />
              <Field label="Владелец" value={s.card_holder} onChange={(v) => set('card_holder', v)} placeholder="Colibri LLC" />
              <Field label="Примечание" value={s.transfer_note} onChange={(v) => set('transfer_note', v)} placeholder="Укажите код заказа в комментарии" />
            </div>
          )}
        </Card>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full btn-fig text-white py-3 rounded-xl font-medium text-[14px] disabled:opacity-60"
      >
        {saving ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
      </button>

      <ImageCropUploader
        open={qrUpload}
        kind="payment-qr"
        onClose={() => setQrUpload(false)}
        onUploaded={(url) => {
          set('qr_image_url', url);
          setQrUpload(false);
        }}
      />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-black/[0.06] p-4 shadow-soft">{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between">
      <span className="text-[14px] font-medium text-ink-soft">{label}</span>
      <span className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-fig-600' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="text-[11px] text-ink-subtle mb-1 px-0.5 block">{label}</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-lg border border-black/[0.1] text-[13.5px] text-ink-soft placeholder:text-ink-faint focus:outline-none focus:border-fig-600/40 ${mono ? 'font-mono tracking-wide' : ''}`}
      />
    </div>
  );
}
