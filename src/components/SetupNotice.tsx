import Link from 'next/link';

export function SetupNotice({ locale }: { locale: string }) {
  return (
    <div className="px-5 py-8">
      <div className="surface rounded-2xl border border-fig-600/20 p-5 shadow-card">
        <div className="w-10 h-10 rounded-full bg-gold-300/15 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-300">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </div>
        <h2 className="font-serif text-[20px] text-cream-100 leading-tight">
          {locale === 'ru' ? 'Настройка Supabase' : 'Танзими Supabase'}
        </h2>
        <p className="text-[13px] text-cream-100/55 mt-2 leading-relaxed">
          {locale === 'ru'
            ? 'Создайте файл .env.local в корне проекта и добавьте ключи Supabase. Затем выполните SQL-миграции из supabase/migrations/ и seed/.'
            : 'Файли .env.local-ро дар реша эҷод кунед ва калидҳои Supabase-ро илова кунед. Сипас миграцияҳои SQL-ро аз supabase/migrations/ ва seed/ иҷро кунед.'}
        </p>
        <div className="mt-4 bg-forest-700 rounded-lg p-3 font-mono text-[11px] text-cream-100 overflow-x-auto">
          <div>NEXT_PUBLIC_SUPABASE_URL=...</div>
          <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</div>
        </div>
        <p className="text-[11px] text-cream-100/45 mt-3">
          {locale === 'ru' ? 'Подробнее в README.md' : 'Тафсилот дар README.md'}
        </p>
      </div>
    </div>
  );
}
