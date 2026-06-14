import Link from 'next/link';
import { formatSom } from '@/lib/format';
import { giftTagLabel } from '@/lib/categories';
import type { Product } from '@/lib/types';
import { SmartImage } from '@/components/images/SmartImage';

// Premium gift-set card (server component). The detail route resolves by
// product id, so the [category] segment is cosmetic — we use the gift type.
export function GiftCard({ product, locale }: { product: Product; locale: string }) {
  const name = locale === 'ru' ? product.name_ru : product.name_tj;
  const typeSegment = product.category ?? 'gift_box';
  const href = `/${locale}/gifts/${typeSegment}/${product.id}`;

  return (
    <Link href={href} className="group block surface rounded-[1.5rem] overflow-hidden card-lift">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-forest-700 to-forest-900">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.05]">
          <SmartImage
            src={product.images?.[0]?.url}
            alt={name}
            seed={name}
            fallbackWidth={400}
            fallbackHeight={500}
            sizes="(max-width: 448px) 50vw, 200px"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/70 via-transparent to-transparent pointer-events-none" />
        {product.category && (
          <span className="absolute top-2.5 left-2.5 text-[9.5px] font-medium tracking-wide uppercase glass-dark text-gold-300 px-2 py-0.5 rounded-full">
            {giftTagLabel(product.category, locale)}
          </span>
        )}
      </div>

      <div className="p-3.5">
        <h3 className="font-serif text-[15px] text-cream-100 leading-tight line-clamp-1">{name}</h3>
        <div className="mt-1.5 flex items-baseline gap-0.5">
          <span className="text-[15px] font-bold text-gold-300">{formatSom(product.price)}</span>
          <span className="text-[11px] text-cream-100/50">сом</span>
        </div>
      </div>
    </Link>
  );
}
