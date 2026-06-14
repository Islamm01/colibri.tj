import Link from 'next/link';
import { SmartImage } from '@/components/images/SmartImage';

// =====================================================================
// CategoryTile — the platform's premium image-backed category/nav card.
//
// One component powers every major category entry (home pillars + gift
// categories) so the visual language stays identical everywhere:
//   • full-bleed photography (SmartImage → branded gradient when absent)
//   • a bottom-up legibility scrim so text is always readable (AA)
//   • an accent wash (emerald depth, or a gold luxe glow for premium)
//   • a frosted glyph chip, serif title, optional eyebrow/subtitle/stat
//   • slow image zoom + lift on hover/press
// Image-ready: pass a real `imageUrl` and it lights up automatically.
// =====================================================================

type Accent = 'emerald' | 'gold';

interface Props {
  href: string;
  title: string;
  seed: string; // stable seed for the branded placeholder when no image
  eyebrow?: string;
  subtitle?: string;
  stat?: string;
  imageUrl?: string | null;
  glyph?: React.ReactNode;
  accent?: Accent;
  ratioClass?: string;
  priority?: boolean;
  sizes?: string;
}

export function CategoryTile({
  href,
  title,
  seed,
  eyebrow,
  subtitle,
  stat,
  imageUrl,
  glyph,
  accent = 'emerald',
  ratioClass = 'aspect-[4/5]',
  priority = false,
  sizes = '(max-width: 448px) 50vw, 220px',
}: Props) {
  const premium = accent === 'gold';

  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-[1.5rem] card-lift shadow-card ${
        premium ? 'border border-gold-300/25 hover:shadow-gold-glow' : 'border border-gold-300/10 hover:shadow-card-hover'
      }`}
    >
      {/* Background image (real photo, or branded gradient placeholder) */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 transition-transform duration-[1100ms] ease-out group-hover:scale-[1.07]">
          <SmartImage
            src={imageUrl}
            alt={title}
            seed={seed}
            showGlyph={false}
            fallbackWidth={400}
            fallbackHeight={500}
            sizes={sizes}
            priority={priority}
          />
        </div>
        {/* Bottom-up legibility scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/92 via-forest-900/40 to-forest-900/5" />
        {/* Accent wash — emerald depth, or gold luxe for premium */}
        <div
          className={`absolute inset-0 ${
            premium
              ? 'bg-gradient-to-tr from-fig-900/35 via-transparent to-gold-300/15'
              : 'bg-gradient-to-tr from-fig-900/25 via-transparent to-transparent'
          }`}
        />
        {premium && (
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-300/20 blur-2xl pointer-events-none" />
        )}
      </div>

      {/* Frosted glyph chip */}
      {glyph && (
        <span className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full glass-dark flex items-center justify-center text-gold-300 transition-transform group-hover:scale-110">
          {glyph}
        </span>
      )}

      {/* Content */}
      <div className={`relative ${ratioClass} flex flex-col justify-end p-4`}>
        {eyebrow && (
          <p className="text-[10px] font-medium tracking-[1.6px] uppercase text-gold-300/90 mb-1">{eyebrow}</p>
        )}
        <h3 className="font-serif text-[18px] leading-tight text-cream-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11.5px] text-cream-100/75 mt-1 leading-snug line-clamp-2">{subtitle}</p>
        )}
        {stat && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-300" />
            <span className="text-[10.5px] text-cream-100/80">{stat}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
