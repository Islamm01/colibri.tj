'use client';

import { useEffect, useState } from 'react';
import type { Product, ProductUnit } from '@/lib/types';
import { PRODUCT_CATEGORIES, GIFT_TYPES } from '@/lib/categories';
import { ImageCropUploader } from '@/components/images/ImageCropUploader';
import { SmartImage } from '@/components/images/SmartImage';

const UNITS: { value: ProductUnit; label: string }[] = [
  { value: 'kg', label: 'кг' },
  { value: 'piece', label: 'шт' },
  { value: 'pack', label: 'уп' },
  { value: 'gram', label: 'г' },
  { value: 'ton', label: 'тонна' },
];

// Storefront categories selectable in the admin form, sourced from the shared
// taxonomy (single source of truth). Staff UI is Russian-only, like the rest
// of this component.
const CATEGORY_OPTIONS: { value: string; label: string }[] = PRODUCT_CATEGORIES.map(
  (c) => ({ value: c.key, label: c.ru }),
);

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeVertical, setStoreVertical] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/products');
      const data = await res.json();
      setProducts(data.products ?? []);
      setStoreVertical(data.store_vertical ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleAvailability(p: Product) {
    await fetch(`/api/staff/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: !p.is_available }),
    });
    await load();
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Удалить «${p.name_ru}»?`)) return;
    await fetch(`/api/staff/products/${p.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="px-5 lg:px-7 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-[24px] text-ink-soft leading-tight">Товары</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-fig text-white text-[12px] font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Добавить
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 bg-white rounded-xl border border-black/[0.06] ${
                !p.is_available ? 'opacity-60' : ''
              }`}
            >
              <div className="relative w-12 h-12 rounded-lg bg-cream-100 overflow-hidden shrink-0">
                <SmartImage src={p.images?.[0]?.url} alt={p.name_ru} seed={p.name_ru} fallbackWidth={48} fallbackHeight={48} sizes="48px" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-ink-soft truncate">{p.name_ru}</div>
                <div className="text-[11px] text-ink-muted truncate">{p.name_tj}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-medium text-ink-soft tabular-nums">
                  {Number(p.price).toFixed(0)} сом
                </div>
                <div className="text-[10px] text-ink-muted">за {UNITS.find((u) => u.value === p.unit)?.label}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditing(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/[0.04] text-ink-muted"
                  aria-label="Edit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  onClick={() => toggleAvailability(p)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/[0.04] ${
                    p.is_available ? 'text-green-700' : 'text-ink-faint'
                  }`}
                  aria-label="Toggle availability"
                  title={p.is_available ? 'Скрыть' : 'Показать'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {p.is_available ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => deleteProduct(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-ink-faint hover:text-red-600"
                  aria-label="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="py-12 text-center text-[13px] text-ink-muted">
              Нет товаров. Нажмите «Добавить» чтобы создать первый.
            </div>
          )}
        </div>
      )}

      {(editing || creating) && (
        <ProductFormDrawer
          product={editing}
          storeVertical={storeVertical}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={async () => {
            setEditing(null);
            setCreating(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ProductFormDrawer({
  product,
  storeVertical,
  onClose,
  onSaved,
}: {
  product: Product | null;
  storeVertical: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isGift = storeVertical === 'gifts';
  const categoryOptions = isGift
    ? GIFT_TYPES.map((g) => ({ value: g.key, label: g.ru }))
    : CATEGORY_OPTIONS;

  const [nameRu, setNameRu] = useState(product?.name_ru ?? '');
  const [nameTj, setNameTj] = useState(product?.name_tj ?? '');
  const [price, setPrice] = useState(product?.price.toString() ?? '');
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? (isGift ? 'piece' : 'kg'));
  const [category, setCategory] = useState(
    product?.category ?? (isGift ? GIFT_TYPES[0].key : 'fresh'),
  );
  const [imageUrl, setImageUrl] = useState(product?.images?.[0]?.url ?? '');
  const [stock, setStock] = useState(product?.stock?.toString() ?? '');
  const [isWholesale, setIsWholesale] = useState(product?.is_wholesale ?? false);
  const [minQuantity, setMinQuantity] = useState(product?.min_quantity?.toString() ?? '');
  // Gift-only fields
  const [descRu, setDescRu] = useState(product?.description_ru ?? '');
  const [descTj, setDescTj] = useState(product?.description_tj ?? '');
  const [giftContents, setGiftContents] = useState(product?.gift_contents ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  async function save() {
    setError(null);
    if (!nameRu.trim() || !nameTj.trim()) {
      setError('Заполните название на двух языках');
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError('Укажите цену');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name_ru: nameRu,
        name_tj: nameTj,
        price: priceNum,
        unit,
        category,
        image_url: imageUrl || undefined,
        stock: stock ? Number(stock) : null,
        is_wholesale: isGift ? false : isWholesale,
        min_quantity: !isGift && isWholesale && minQuantity ? Number(minQuantity) : null,
        // Gift sets carry a story (description) + contents.
        ...(isGift && {
          description_ru: descRu.trim() || null,
          description_tj: descTj.trim() || null,
          gift_contents: giftContents.trim() || null,
        }),
      };
      const res = product
        ? await fetch(`/api/staff/products/${product.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/staff/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error ?? 'Ошибка сохранения');
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade-in" aria-label="Close" />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-up">
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <h2 className="font-serif text-[18px] text-ink-soft">
            {product ? 'Редактировать' : 'Новый товар'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <Field label="Название (русский)">
            <input
              type="text"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Название (тоҷикӣ)">
            <input
              type="text"
              value={nameTj}
              onChange={(e) => setNameTj(e.target.value)}
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Цена (сом)">
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Единица">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as ProductUnit)}
                className="form-input"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={isGift ? 'Тип набора' : 'Категория'}>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input">
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          {/* Gift-set fields (only for stores in the 'gifts' vertical) */}
          {isGift && (
            <>
              <Field label="Описание набора (русский)">
                <textarea
                  value={descRu}
                  onChange={(e) => setDescRu(e.target.value)}
                  rows={2}
                  className="form-input resize-none"
                />
              </Field>
              <Field label="Описание набора (тоҷикӣ)">
                <textarea
                  value={descTj}
                  onChange={(e) => setDescTj(e.target.value)}
                  rows={2}
                  className="form-input resize-none"
                />
              </Field>
              <Field label="Что внутри">
                <textarea
                  value={giftContents}
                  onChange={(e) => setGiftContents(e.target.value)}
                  rows={3}
                  placeholder="напр. Мёд 0.5 кг, грецкий орех 0.3 кг, курага 0.2 кг"
                  className="form-input resize-none"
                />
              </Field>
            </>
          )}

          {/* Wholesale (Slice 2) — not applicable to gift sets */}
          {!isGift && (
            <>
              <Field label="Оптовый товар">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isWholesale}
                    onChange={(e) => setIsWholesale(e.target.checked)}
                    className="w-4 h-4 accent-fig-600"
                  />
                  <span className="text-[13px] text-ink-soft">Продаётся оптом (тонна/кг, минимальный заказ)</span>
                </label>
              </Field>
              {isWholesale && (
                <Field label="Минимальный заказ (пусто = без минимума)">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    placeholder="напр. 600"
                    className="form-input"
                  />
                </Field>
              )}
            </>
          )}
          <Field label="Изображение">
            {imageUrl ? (
              <div className="flex items-start gap-3">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                  <SmartImage src={imageUrl} alt={nameRu || 'Товар'} seed={nameRu || 'A'} fallbackWidth={80} fallbackHeight={80} sizes="80px" />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  {product ? (
                    <button
                      type="button"
                      onClick={() => setUploaderOpen(true)}
                      className="px-3 py-1.5 rounded-md bg-fig-50 hover:bg-fig-100 text-fig-700 text-[12px] font-medium w-fit"
                    >
                      Заменить
                    </button>
                  ) : (
                    <p className="text-[11px] text-ink-muted">Сохраните товар, чтобы добавить фото</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-[11px] text-ink-muted hover:text-red-600 w-fit"
                  >
                    Удалить фото
                  </button>
                </div>
              </div>
            ) : product ? (
              <button
                type="button"
                onClick={() => setUploaderOpen(true)}
                className="w-full h-24 rounded-lg border-2 border-dashed border-black/[0.1] hover:border-fig-600/40 hover:bg-fig-50/50 transition-all flex flex-col items-center justify-center gap-1 text-ink-muted hover:text-fig-700"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span className="text-[12px] font-medium">Загрузить фото</span>
              </button>
            ) : (
              <div className="w-full h-24 rounded-lg border border-dashed border-black/[0.08] flex items-center justify-center text-center px-3">
                <p className="text-[11px] text-ink-muted">Сохраните товар — затем сможете добавить фото</p>
              </div>
            )}
          </Field>
          <Field label="Остаток (пусто = без ограничения)">
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="form-input"
            />
          </Field>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-black/[0.06] safe-bottom">
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3 rounded-lg btn-fig text-white font-medium text-[14px] disabled:opacity-70"
          >
            {saving ? 'Сохранение...' : product ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(0, 0, 0, 0.1);
          font-size: 14px;
          background: white;
        }
        :global(.form-input:focus) {
          outline: none;
          border-color: rgba(122, 33, 158, 0.4);
          box-shadow: 0 0 0 3px rgba(122, 33, 158, 0.15);
        }
      `}</style>

      {product && (
        <ImageCropUploader
          open={uploaderOpen}
          kind="product"
          productId={product.id}
          onClose={() => setUploaderOpen(false)}
          onUploaded={async (publicUrl) => {
            setImageUrl(publicUrl);
            // Immediately persist so the change survives if the user closes the drawer
            await fetch(`/api/staff/products/${product.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_url: publicUrl }),
            });
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-ink-muted block mb-1">{label}</label>
      {children}
    </div>
  );
}
