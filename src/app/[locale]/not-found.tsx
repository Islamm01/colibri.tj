import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function LocaleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations('common');

  return (
    <div className="px-8 py-20 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-gold-300/15 flex items-center justify-center mb-5 text-gold-300">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
      </div>
      <h1 className="font-serif text-[22px] text-cream-100 leading-tight">404</h1>
      <p className="text-[13px] text-cream-100/55 mt-2 max-w-[260px]">
        {locale === 'ru' ? 'Страница не найдена' : 'Саҳифа ёфт нашуд'}
      </p>
      <Link
        href={`/${locale}`}
        className="mt-6 btn-fig text-white px-5 py-2.5 rounded-xl text-[13px] font-medium"
      >
        ← {t('back')}
      </Link>
    </div>
  );
}
