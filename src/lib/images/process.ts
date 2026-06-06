'use client';

// =====================================================================
// Colibri — Client-side image processing
//
// Takes a source image (File) + crop area (from react-easy-crop) and
// produces optimized WebP blobs at one or more target sizes.
//
// Why client-side: a 5MB iPhone photo would take 30+ seconds to upload
// on Khujand 3G. We resize before the upload starts.
// =====================================================================

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TargetSize {
  /** Width in pixels of the output. Height is derived from aspect. */
  width: number;
  /** Aspect ratio (e.g. 1 for square, 16/9 for banner). */
  aspect: number;
  /** WebP quality 0-1. Default 0.85. */
  quality?: number;
  /** Suffix to identify the variant (e.g. 'full', 'thumb'). */
  variant: string;
}

export interface ProcessedImage {
  variant: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Load a File as an HTMLImageElement, respecting EXIF orientation.
 * Modern browsers handle orientation automatically when an image is loaded
 * via blob URL on a canvas; we use createImageBitmap which is the cleanest path.
 */
async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/**
 * Render the cropped region to a target size at the given quality.
 */
async function renderCrop(
  bitmap: ImageBitmap,
  crop: CropArea,
  target: TargetSize,
): Promise<ProcessedImage> {
  const outWidth = target.width;
  const outHeight = Math.round(outWidth / target.aspect);

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Use better resampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outWidth,
    outHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(
      resolve,
      'image/webp',
      target.quality ?? 0.85,
    ),
  );
  if (!blob) throw new Error('WebP encode failed');

  return { variant: target.variant, blob, width: outWidth, height: outHeight };
}

/**
 * Main entry — produce one or more variants from a source file + crop area.
 */
export async function processCroppedImage(
  file: File,
  crop: CropArea,
  targets: TargetSize[],
): Promise<ProcessedImage[]> {
  const bitmap = await loadImage(file);
  try {
    const results: ProcessedImage[] = [];
    for (const target of targets) {
      results.push(await renderCrop(bitmap, crop, target));
    }
    return results;
  } finally {
    bitmap.close();
  }
}

// =====================================================================
// Preset target configurations matching Colibri brand decisions
// =====================================================================

export const PRESETS = {
  product: [
    { variant: 'full', width: 800, aspect: 1, quality: 0.85 },
    { variant: 'thumb', width: 400, aspect: 1, quality: 0.82 },
  ] as TargetSize[],
  // Price-index items only ever render as a small thumbnail, so a single
  // compact square is enough.
  price: [
    { variant: 'full', width: 240, aspect: 1, quality: 0.85 },
  ] as TargetSize[],
  storeLogo: [
    { variant: 'full', width: 400, aspect: 1, quality: 0.88 },
  ] as TargetSize[],
  storeCover: [
    { variant: 'full', width: 1600, aspect: 16 / 9, quality: 0.85 },
    { variant: 'thumb', width: 800, aspect: 16 / 9, quality: 0.82 },
  ] as TargetSize[],
};

export const ASPECT = {
  product: 1,
  price: 1,
  storeLogo: 1,
  storeCover: 16 / 9,
};
