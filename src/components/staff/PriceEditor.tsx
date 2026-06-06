'use client';

import { useEffect, useState } from 'react';
import { ImageCropUploader } from '@/components/images/ImageCropUploader';

interface PriceRow {
  id: string;
  item_key: string;
  name_ru: string;
  emoji: string | null;
  image_url: string | null;
  unit: string;
  farm_low: number | null;
  farm_high: number | null;
  bazaar_low: number | null;
  bazaar_high: number | null;
  trend: 'up' | 'down' | 'flat';
}

export function PriceEditor({ role }: { role: 'admin' | 'operator' }) {
  const isAdmin = role === 'admin';
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [newCategory, setNewCategory] = useState('fruit');
  const [photoFor, setPhotoFor] = useState<PriceRow | null>(null);

  async function load() {
    // Use the staff catalog (latest row per item) so the list stays stable —
    // the public /api/price-index only returns a single day and would hide
    // items as soon as one is edited.
    const res = await fetch('/api/staff/price-index');
    const data = await res.json();
    setRows(data.prices ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addProduct() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/staff/price-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_ru: newName.trim(),
          emoji: newEmoji.trim() || undefined,
          category: newCategory,
          unit: 'kg',
        }),
      });
      if (res.ok) {
        setNewName('');
        setNewEmoji('');
        setNewCategory('fruit');
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteProduct(row: PriceRow) {
    if (!confirm(`Удалить «${row.name_ru}» из индекса цен?`)) return;
    setDeletingKey(row.item_key);
    try {
      const res = await fetch('/api/staff/price-index', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_key: row.item_key }),
      });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.item_key !== row.item_key));
      }
    } finally {
      setDeletingKey(null);
    }
  }

  async function savePhoto(row: PriceRow, imageUrl: string) {
    setRows((prev) =>
      prev.map((r) => (r.item_key === row.item_key ? { ...r, image_url: imageUrl } : r)),
    );
    await fetch('/api/staff/price-index', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_key: row.item_key, image_url: imageUrl }),
    });
  }

  function update(key: string, field: keyof PriceRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.item_key === key ? { ...r, [field]: value === '' ? null : value } : r)),
    );
  }

  async function save(row: PriceRow) {
    setSavingKey(row.item_key);
    setSavedKey(null);
    try {
      const res = await fetch('/api/staff/price-index', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_key: row.item_key,
          farm_low: row.farm_low,
          farm_high: row.farm_high,
          bazaar_low: row.bazaar_low,
          bazaar_high: row.bazaar_high,
          trend: row.trend,
        }),
      });
      if (res.ok) {
        setSavedKey(row.item_key);
        setTimeout(() => setSavedKey(null), 2000);
      }
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <div className="px-5 lg:px-7 py-6 text-ink-muted text-[13px]">Загрузка...</div>;
  }

  return (
    <div className="px-5 lg:px-7 py-5 max-w-3xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Цены дня</h1>
      <p className="text-[13px] text-ink-muted mb-5">
        Обновите цены — клиенты видят их на странице «Цены Худжанда». Указывайте диапазон в сомони за кг.
      </p>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-black/[0.06] p-3.5 shadow-soft mb-5">
          <div className="text-[12px] font-medium text-ink-soft mb-2.5">Добавить продукт</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="🍎"
              className="w-14 px-2.5 py-2 rounded-lg border border-black/[0.1] text-[14px] text-center focus:outline-none focus:border-fig-600/40 focus:ring-2 focus:ring-fig-600/15"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название (рус)"
              className="flex-1 min-w-[140px] px-2.5 py-2 rounded-lg border border-black/[0.1] text-[14px] text-ink-soft focus:outline-none focus:border-fig-600/40 focus:ring-2 focus:ring-fig-600/15"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-black/[0.1] text-[14px] text-ink-soft bg-white focus:outline-none focus:border-fig-600/40"
            >
              <option value="fruit">Фрукт</option>
              <option value="vegetable">Овощ</option>
              <option value="nut">Орех</option>
              <option value="dried">Сухофрукт</option>
            </select>
            <button
              onClick={addProduct}
              disabled={adding || !newName.trim()}
              className="px-4 py-2 rounded-lg btn-fig text-white text-[12.5px] font-medium disabled:opacity-60"
            >
              {adding ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.06] p-6 text-center text-[13px] text-ink-muted">
          {isAdmin ? 'Продуктов пока нет — добавьте первый выше.' : 'Продуктов пока нет. Обратитесь к администратору.'}
        </div>
      )}

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.id} className="bg-white rounded-2xl border border-black/[0.06] p-3.5 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              {isAdmin ? (
                <button
                  onClick={() => setPhotoFor(row)}
                  className="w-9 h-9 rounded-lg overflow-hidden border border-black/[0.1] flex items-center justify-center bg-black/[0.02] shrink-0 hover:border-fig-600/40 transition-colors"
                  title={row.image_url ? 'Изменить фото' : 'Добавить фото'}
                >
                  {row.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[18px] leading-none">{row.emoji ?? '＋'}</span>
                  )}
                </button>
              ) : row.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.image_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-black/[0.06] shrink-0" />
              ) : (
                <span className="text-[20px]">{row.emoji ?? '•'}</span>
              )}
              <span className="text-[14px] font-medium text-ink-soft flex-1">{row.name_ru}</span>
              {/* Trend selector */}
              <div className="flex gap-1">
                {(['down', 'flat', 'up'] as const).map((tr) => (
                  <button
                    key={tr}
                    onClick={() => update(row.item_key, 'trend', tr)}
                    className={`w-7 h-7 rounded-lg text-[12px] flex items-center justify-center border transition-all ${
                      row.trend === tr
                        ? 'bg-fig-50 border-fig-600/40 text-fig-700'
                        : 'bg-white border-black/[0.08] text-ink-faint'
                    }`}
                    title={tr === 'up' ? 'выше' : tr === 'down' ? 'ниже' : 'без изменений'}
                  >
                    {tr === 'up' ? '↑' : tr === 'down' ? '↓' : '–'}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <button
                  onClick={() => deleteProduct(row)}
                  disabled={deletingKey === row.item_key}
                  className="w-7 h-7 rounded-lg text-[14px] flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-all"
                  title="Удалить продукт"
                >
                  {deletingKey === row.item_key ? '…' : '×'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1.5">У фермера</div>
                <div className="flex items-center gap-1.5">
                  <NumInput value={row.farm_low} onChange={(v) => update(row.item_key, 'farm_low', v)} />
                  <span className="text-ink-faint">–</span>
                  <NumInput value={row.farm_high} onChange={(v) => update(row.item_key, 'farm_high', v)} />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1.5">Базар</div>
                <div className="flex items-center gap-1.5">
                  <NumInput value={row.bazaar_low} onChange={(v) => update(row.item_key, 'bazaar_low', v)} />
                  <span className="text-ink-faint">–</span>
                  <NumInput value={row.bazaar_high} onChange={(v) => update(row.item_key, 'bazaar_high', v)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-3">
              <button
                onClick={() => save(row)}
                disabled={savingKey === row.item_key}
                className="px-4 py-2 rounded-lg btn-fig text-white text-[12.5px] font-medium disabled:opacity-60"
              >
                {savingKey === row.item_key ? 'Сохранение...' : savedKey === row.item_key ? '✓ Сохранено' : 'Сохранить'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && photoFor && (
        <ImageCropUploader
          open={!!photoFor}
          kind="price"
          itemKey={photoFor.item_key}
          onClose={() => setPhotoFor(null)}
          onUploaded={(url) => {
            if (photoFor) savePhoto(photoFor, url);
            setPhotoFor(null);
          }}
        />
      )}
    </div>
  );
}

function NumInput({ value, onChange }: { value: number | null; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-2 rounded-lg border border-black/[0.1] text-[14px] text-ink-soft tabular-nums text-center focus:outline-none focus:border-fig-600/40 focus:ring-2 focus:ring-fig-600/15"
      placeholder="0"
    />
  );
}
