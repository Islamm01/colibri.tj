import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { readSession } from '@/lib/session/server';
import { formatSom } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  public_code: string;
  status: string;
  vertical: string | null;
  total: number;
  created_at: string;
  store: { name: string } | { name: string }[] | null;
}

const STATUS_LABELS_RU: Record<string, string> = {
  placed: 'Размещён',
  accepted: 'Принят',
  preparing: 'Готовится',
  ready: 'Готов',
  courier_assigned: 'Курьер назначен',
  picked_up: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const STATUS_LABELS_TJ: Record<string, string> = {
  placed: 'Қабул шуд',
  accepted: 'Қабул шуд',
  preparing: 'Тайёр карда мешавад',
  ready: 'Тайёр',
  courier_assigned: 'Паёмбар таъин шуд',
  picked_up: 'Дар роҳ',
  delivered: 'Расонида шуд',
  cancelled: 'Бекор карда шуд',
};

const STATUS_TONE: Record<string, string> = {
  placed: 'bg-gold-50 text-gold-700',
  accepted: 'bg-gold-50 text-gold-700',
  preparing: 'bg-gold-50 text-gold-700',
  ready: 'bg-gold-300/15 text-gold-300',
  courier_assigned: 'bg-gold-300/15 text-gold-300',
  picked_up: 'bg-gold-300/15 text-gold-300',
  delivered: 'bg-green-50 text-gold-300',
  cancelled: 'bg-red-50 text-berry',
};

function statusLabel(status: string, locale: string): string {
  return (locale === 'tj' ? STATUS_LABELS_TJ : STATUS_LABELS_RU)[status] ?? status;
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('orders');
  const tCart = await getTranslations('cart');
  const session = await readSession();

  // Not logged in / no session — show empty state with CTA
  if (!session) {
    return <EmptyState locale={locale} title={t('emptyTitle')} hint={t('signedOutHint')} cta={tCart('browse')} />;
  }

  if (!isSupabaseConfigured()) {
    return <EmptyState locale={locale} title={t('emptyTitle')} hint={t('emptyHint')} cta={tCart('browse')} />;
  }

  let orders: OrderRow[] = [];
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from('orders')
      .select('id, public_code, status, vertical, total, created_at, store:store_id (name)')
      .eq('customer_user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(30);
    orders = (data ?? []) as OrderRow[];
  } catch {
    orders = [];
  }

  if (orders.length === 0) {
    return <EmptyState locale={locale} title={t('emptyTitle')} hint={t('emptyHint')} cta={tCart('browse')} />;
  }

  return (
    <div className="px-5 pt-5 pb-24">
      <h1 className="font-serif text-[24px] text-cream-100 leading-tight mb-1">{t('title')}</h1>
      <p className="text-[13px] text-cream-100/55 mb-5">{t('subtitle', { count: orders.length })}</p>

      <div className="space-y-3">
        {orders.map((order) => {
          const storeData = Array.isArray(order.store) ? order.store[0] : order.store;
          const title =
            order.vertical === 'parcel'
              ? t('parcelOrder')
              : storeData?.name ?? t('foodOrder');
          const tone = STATUS_TONE[order.status] ?? 'bg-forest-700 text-cream-100/55';
          const dateLabel = new Date(order.created_at).toLocaleDateString(
            locale === 'tj' ? 'tg' : 'ru',
            { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
          );

          return (
            <Link
              key={order.id}
              href={`/${locale}/track/${order.public_code}`}
              className="block surface rounded-2xl border border-gold-300/10 p-4 shadow-soft hover:shadow-card transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] text-cream-100/35 tracking-wider mb-0.5">
                    {order.public_code}
                  </div>
                  <div className="text-[14px] font-medium text-cream-100 truncate">{title}</div>
                  <div className="text-[11px] text-cream-100/55 mt-0.5">{dateLabel}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-medium text-cream-100 tabular-nums">
                    {formatSom(Number(order.total))} <span className="text-[11px] text-cream-100/55 font-normal">сом</span>
                  </div>
                  <div className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded mt-1 ${tone}`}>
                    {statusLabel(order.status, locale)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  locale,
  title,
  hint,
  cta,
}: {
  locale: string;
  title: string;
  hint: string;
  cta: string;
}) {
  return (
    <div className="px-8 py-16 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-gold-300/15 flex items-center justify-center mb-5 text-gold-300 animate-pop">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      </div>
      <h1 className="font-serif text-[22px] text-cream-100 leading-tight">{title}</h1>
      <p className="text-[13px] text-cream-100/55 mt-2 leading-relaxed max-w-[260px]">{hint}</p>
      <Link
        href={`/${locale}/marketplace`}
        className="mt-6 btn-fig text-white px-5 py-2.5 rounded-xl text-[13px] font-medium"
      >
        {cta}
      </Link>
    </div>
  );
}
