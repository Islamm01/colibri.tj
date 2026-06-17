import Link from 'next/link';

// =====================================================================
// CategoryTile — the platform's premium image-backed category/nav card.
//
// Renders a CURATED, permanent brand asset (from /public/categories) — it
// never depends on store covers, product photos, or uploaded content, and
// never appears empty. One component powers every category surface so the
// visual language stays identical everywhere:
//   • full-bleed branded panel (CSS cover, center-cropped at any aspect)
//   • a bottom-up legibility scrim so text is always readable (AA)
//   • an accent wash (emerald depth, or a gold luxe glow for premium)
//   • a frosted glyph chip, serif title, optional eyebrow/subtitle/stat
//   • one subtle lift on hover (GPU transform); no image zoom/scale churn
// =====================================================================

type Accent = 'emerald' | 'gold';

interface Props {
  href: string;
  title: string;
  image: string; // permanent asset path, e.g. '/categories/fruits.svg'
  eyebrow?: string;
  subtitle?: string;
  stat?: string;
  glyph?: React.ReactNode;
  accent?: Accent;
  ratioClass?: string;
}

export function CategoryTile({
  href,
  title,
  image,
  eyebrow,
  subtitle,
  stat,
  glyph,
  accent = 'emerald',
  ratioClass = 'aspect-[4/5]',
}: Props) {
  const premium = accent === 'gold';

  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-[1.5rem] card-lift shadow-card ${
        premium ? 'border border-gold-300/25 hover:shadow-gold-glow' : 'border border-gold-300/10 hover:shadow-card-hover'
      }`}
    >
      {/* Curated brand panel */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        />
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
        <span className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full glass-dark flex items-center justify-center text-gold-300">
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
