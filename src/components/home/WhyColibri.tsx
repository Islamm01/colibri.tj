import { getTranslations } from 'next-intl/server';

export async function WhyColibri() {
  const t = await getTranslations('whyColibri');

  const benefits = [
    {
      key: 'fresh',
      icon: <LeafIcon />,
      color: 'text-gold-300',
      bg: 'bg-gold-300/15',
      ring: 'ring-gold-300/20',
      glow: 'shadow-[0_0_18px_-4px_rgba(200,241,105,0.35)]',
    },
    {
      key: 'fastDelivery',
      icon: <BoltIcon />,
      color: 'text-berry-400',
      bg: 'bg-berry/15',
      ring: 'ring-berry/20',
      glow: 'shadow-[0_0_18px_-4px_rgba(255,79,94,0.35)]',
    },
    {
      key: 'cashOnDelivery',
      icon: <WalletIcon />,
      color: 'text-citrus',
      bg: 'bg-citrus/15',
      ring: 'ring-citrus/20',
      glow: 'shadow-[0_0_18px_-4px_rgba(255,164,58,0.35)]',
    },
    {
      key: 'fairPrices',
      icon: <TagIcon />,
      color: 'text-fig-300',
      bg: 'bg-fig-300/15',
      ring: 'ring-fig-300/20',
      glow: 'shadow-[0_0_18px_-4px_rgba(111,174,155,0.35)]',
    },
  ];

  const Card = ({ b }: { b: (typeof benefits)[number] }) => (
    <div className="surface rounded-2xl p-4 card-lift flex flex-col gap-3 h-full">
      <div
        className={`w-10 h-10 rounded-2xl ${b.bg} ${b.color} ${b.ring} ring-1 ${b.glow} flex items-center justify-center shrink-0`}
      >
        {b.icon}
      </div>
      <div>
        <div className="text-[13px] font-semibold text-cream-100 leading-snug">
          {t(`benefits.${b.key}.title`)}
        </div>
        <div className="text-[11px] text-cream-100/45 leading-snug mt-1">
          {t(`benefits.${b.key}.hint`)}
        </div>
      </div>
    </div>
  );

  return (
    <section className="px-5 py-9 animate-fade-up">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-[10px] font-medium text-gold-300 tracking-[2.5px] uppercase mb-2">
            {t('eyebrow')}
          </div>
          <h2 className="font-serif text-[23px] text-cream-100 leading-[1.25]">
            {t('headline')}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {benefits.map((b) => (
            <Card key={b.key} b={b} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* Icons — 18px, stroke 1.6 */
function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.5c1 1.5.5 7-1 11-1.4 3.6-5.2 6.4-7.2 6.5Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
      <path d="M16 12h.01" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 3.5h7l9.5 9.5a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0L3.5 10.5v-7Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
