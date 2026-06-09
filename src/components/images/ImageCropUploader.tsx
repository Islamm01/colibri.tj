'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { processCroppedImage, ASPECT, PRESETS, type TargetSize } from '@/lib/images/process';

type UploadKind = 'product' | 'store-logo' | 'store-cover' | 'price' | 'payment-qr';

interface Props {
  open: boolean;
  kind: UploadKind;
  /** Required when kind === 'product' */
  productId?: string;
  /** Required when kind === 'price' */
  itemKey?: string;
  onClose: () => void;
  /** Called with the public URL of the primary (full-size) variant. */
  onUploaded: (publicUrl: string, allUploads: Array<{ variant: string; publicUrl: string }>) => void;
}

function aspectFor(kind: UploadKind): number {
  if (kind === 'product') return ASPECT.product;
  if (kind === 'price') return ASPECT.price;
  if (kind === 'payment-qr') return ASPECT.paymentQr;
  if (kind === 'store-logo') return ASPECT.storeLogo;
  return ASPECT.storeCover;
}

function targetsFor(kind: UploadKind): TargetSize[] {
  if (kind === 'product') return PRESETS.product;
  if (kind === 'price') return PRESETS.price;
  if (kind === 'payment-qr') return PRESETS.paymentQr;
  if (kind === 'store-logo') return PRESETS.storeLogo;
  return PRESETS.storeCover;
}

function labelFor(kind: UploadKind): string {
  if (kind === 'product') return 'Фото товара';
  if (kind === 'price') return 'Фото продукта';
  if (kind === 'payment-qr') return 'QR для оплаты';
  if (kind === 'store-logo') return 'Логотип магазина';
  return 'Обложка магазина';
}

export function ImageCropUploader({ open, kind, productId, itemKey, onClose, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<'idle' | 'processing' | 'uploading'>('idle');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setSourceFile(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setError(null);
      setUploading(false);
      setProgress('idle');
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  if (!open) return null;

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Sanity check size — clients can upload huge images, we'll resize, but
    // refuse if it's absurdly large to avoid OOM on weak phones.
    if (file.size > 25 * 1024 * 1024) {
      setError('Файл слишком большой (максимум 25 МБ)');
      return;
    }

    setSourceFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageSrc(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!sourceFile || !croppedAreaPixels) return;
    setError(null);
    setUploading(true);
    setProgress('processing');

    try {
      // 1. Crop + encode WebP variants client-side
      const variants = await processCroppedImage(
        sourceFile,
        {
          x: croppedAreaPixels.x,
          y: croppedAreaPixels.y,
          width: croppedAreaPixels.width,
          height: croppedAreaPixels.height,
        },
        targetsFor(kind),
      );

      // 2. Upload to our /api/staff/upload endpoint
      setProgress('uploading');
      const form = new FormData();
      form.append('kind', kind);
      if (productId) form.append('productId', productId);
      if (itemKey) form.append('itemKey', itemKey);
      for (const v of variants) {
        form.append(`variant_${v.variant}`, v.blob, `${v.variant}.webp`);
      }

      const res = await fetch('/api/staff/upload', {
        method: 'POST',
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Не удалось загрузить');
        return;
      }

      // Find the 'full' variant URL — that's what we save on the entity
      const fullUpload = data.uploads.find((u: { variant: string }) => u.variant === 'full');
      if (!fullUpload) {
        setError('Сервер не вернул URL');
        return;
      }

      onUploaded(fullUpload.publicUrl, data.uploads);
      onClose();
    } catch (e) {
      console.error(e);
      setError('Ошибка обработки изображения');
    } finally {
      setUploading(false);
      setProgress('idle');
    }
  }

  const aspect = aspectFor(kind);
  const cropShape: 'rect' | 'round' = 'rect';

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="surface w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gold-300/10 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[15px] font-medium text-cream-100">{labelFor(kind)}</div>
            {imageSrc && (
              <div className="text-[11px] text-cream-100/55 mt-0.5">
                Подвиньте и масштабируйте
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {!imageSrc ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gold-300/15 flex items-center justify-center text-gold-300 mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <h2 className="font-serif text-[20px] text-cream-100 mb-1.5">Выберите фото</h2>
            <p className="text-[12px] text-cream-100/55 leading-relaxed max-w-[280px] mb-6">
              JPG, PNG или WebP. Мы автоматически обрежем, сожмём и оптимизируем.
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="btn-fig text-white px-5 py-2.5 rounded-lg font-medium text-[13px]"
            >
              Выбрать файл
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFilePick}
              className="hidden"
            />
            {error && (
              <div className="mt-4 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-berry">
                {error}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Cropper */}
            <div className="relative flex-1 bg-black min-h-[280px]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={cropShape}
                showGrid={true}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
                style={{
                  containerStyle: { background: '#000' },
                  cropAreaStyle: { border: '2px solid white', color: 'rgba(0,0,0,0.55)' },
                }}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-3 border-t border-gold-300/10 surface">
              <div className="flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100/55 shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5M8 11h6" />
                </svg>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-fig-600"
                  aria-label="Zoom"
                />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream-100/55 shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
                </svg>
              </div>
            </div>

            {error && (
              <div className="mx-5 mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-berry">
                {error}
              </div>
            )}

            {/* Footer actions */}
            <div className="px-5 py-3.5 border-t border-gold-300/10 safe-bottom flex items-center gap-2">
              <button
                onClick={() => {
                  setImageSrc(null);
                  setSourceFile(null);
                  setZoom(1);
                  setCrop({ x: 0, y: 0 });
                }}
                disabled={uploading}
                className="px-4 py-2.5 rounded-lg text-cream-100/55 hover:bg-black/[0.04] text-[13px] disabled:opacity-50"
              >
                Заменить
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !croppedAreaPixels}
                className="flex-1 btn-fig text-white py-2.5 rounded-lg font-medium text-[14px] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {progress === 'processing' ? 'Обработка...' : 'Загрузка...'}
                  </>
                ) : (
                  'Загрузить'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
