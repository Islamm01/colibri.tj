'use client';

import { useEffect, useState } from 'react';
import type { Store } from '@/lib/types';
import { ImageCropUploader } from '@/components/images/ImageCropUploader';
import { SmartImage } from '@/components/images/SmartImage';

export function StoreSettings() {
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [descRu, setDescRu] = useState('');
  const [descTj, setDescTj] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [logoUploaderOpen, setLogoUploaderOpen] = useState(false);
  const [coverUploaderOpen, setCoverUploaderOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/staff/store');
      const data = await res.json();
      if (data.store) {
        setStore(data.store);
        setName(data.store.name ?? '');
        setDescRu(data.store.description_ru ?? '');
        setDescTj(data.store.description_tj ?? '');
        setAddress(data.store.address ?? '');
        setLogoUrl(data.store.logo_url ?? null);
        setCoverUrl(data.store.cover_image_url ?? null);
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/staff/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description_ru: descRu,
          description_tj: descTj,
          address,
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

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return <div className="px-5 py-5 text-[13px] text-ink-muted">Магазин не найден</div>;
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-5">Настройки</h1>

      {/* Images */}
      <div className="bg-white border border-black/[0.06] rounded-2xl p-5 mb-5">
        <div className="text-[13px] font-medium text-ink-soft mb-1">Изображения</div>
        <div className="text-[11px] text-ink-muted mb-4">Логотип квадратный, обложка 16:9</div>

        <div className="flex gap-4">
          {/* Logo */}
          <div className="shrink-0">
            <div className="text-[10px] uppercase tracking-[1.4px] text-ink-subtle mb-1.5">Логотип</div>
            <button
              type="button"
              onClick={() => setLogoUploaderOpen(true)}
              className="relative w-24 h-24 rounded-2xl overflow-hidden bg-cream-100 border border-black/[0.05] hover:border-fig-600/40 group"
            >
              <SmartImage src={logoUrl} alt={name || 'Логотип'} seed={name || 'A'} fallbackWidth={96} fallbackHeight={96} sizes="96px" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-medium">
                  Изменить
                </span>
              </div>
            </button>
          </div>

          {/* Cover */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[1.4px] text-ink-subtle mb-1.5">Обложка</div>
            <button
              type="button"
              onClick={() => setCoverUploaderOpen(true)}
              className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-cream-100 border border-black/[0.05] hover:border-fig-600/40 group"
            >
              <SmartImage src={coverUrl} alt={name || 'Обложка'} seed={name || 'A'} showGlyph={false} fallbackWidth={400} fallbackHeight={225} sizes="(max-width: 768px) 60vw, 400px" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-medium">
                  Изменить
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-black/[0.06] rounded-2xl p-5 space-y-4">
        <Field label="Название магазина">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40"
          />
        </Field>
        <Field label="Описание (русский)" hint="Видно покупателям на странице магазина">
          <textarea
            value={descRu}
            onChange={(e) => setDescRu(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40 resize-none"
          />
        </Field>
        <Field label="Тавсиф (тоҷикӣ)">
          <textarea
            value={descTj}
            onChange={(e) => setDescTj(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40 resize-none"
          />
        </Field>
        <Field label="Адрес магазина">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:ring-2 focus:ring-fig-600/30 focus:border-fig-600/40"
          />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
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

      <div className="mt-8 text-[11px] text-ink-faint">
        ID магазина: <span className="font-mono">{store.id}</span>
      </div>

      <ImageCropUploader
        open={logoUploaderOpen}
        kind="store-logo"
        onClose={() => setLogoUploaderOpen(false)}
        onUploaded={async (publicUrl) => {
          setLogoUrl(publicUrl);
          await fetch('/api/staff/store', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logo_url: publicUrl }),
          });
        }}
      />
      <ImageCropUploader
        open={coverUploaderOpen}
        kind="store-cover"
        onClose={() => setCoverUploaderOpen(false)}
        onUploaded={async (publicUrl) => {
          setCoverUrl(publicUrl);
          await fetch('/api/staff/store', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cover_image_url: publicUrl }),
          });
        }}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-ink-soft block mb-1">{label}</label>
      {hint && <div className="text-[11px] text-ink-muted mb-1.5">{hint}</div>}
      {children}
    </div>
  );
}
