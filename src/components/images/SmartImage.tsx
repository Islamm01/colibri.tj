'use client';

import Image from 'next/image';
import { useState } from 'react';
import { placeholderSvgDataUri } from '@/lib/images/placeholder';

interface Props {
  src: string | null | undefined;
  alt: string;
  /** Seed for placeholder generation (typically the product/store name). */
  seed: string;
  /** Show letter on placeholder. False = cover-style (textless gradient). */
  showGlyph?: boolean;
  /** Aspect-defined dimensions for the fallback SVG. */
  fallbackWidth?: number;
  fallbackHeight?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fill?: boolean;
}

/**
 * Use this for ALL product images, store logos, and store covers.
 * Renders a branded SVG placeholder when no src is available or when load fails.
 */
export function SmartImage({
  src,
  alt,
  seed,
  showGlyph = true,
  fallbackWidth = 400,
  fallbackHeight = 400,
  sizes = '(max-width: 768px) 50vw, 400px',
  priority = false,
  className,
  fill = true,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    const data = placeholderSvgDataUri({
      seed,
      width: fallbackWidth,
      height: fallbackHeight,
      textless: !showGlyph,
    });
    return (
      // SVG data URIs render best as plain img to avoid Next's optimization overhead
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data}
        alt={alt}
        className={className ?? 'w-full h-full object-cover'}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className ?? 'object-cover'}
      onError={() => setErrored(true)}
    />
  );
}
