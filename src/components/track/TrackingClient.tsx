'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatSom } from '@/lib/format';
import type { OrderStatus, PaymentMethod, ProductUnit } from '@/lib/types';
import { StatusTimeline } from './StatusTimeline';
import { PaymentBlock } from './PaymentBlock';
import { useRealtimeOrder } from '@/lib/realtime/useRealtimeOrders';
import dynamic from 'next/dynamic';

const LiveCourierMap = dynamic(
  () => import('./LiveCourierMap').then((m) => m.LiveCourierMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-forest-700 border border-gold-300/10 h-[220px] animate-pulse" />
    ),
  },
);

interface TrackedOrder {
  id: string;
  public_code: string;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'awaiting_confirmation' | 'paid' | 'failed' | 'refunded';
  notes: string | null;
  prep_eta_minutes: number | null;
  delivery_eta_minutes: number | null;
  created_at: string;
  store: { id: string; name: string; slug: string; address: string | null; lat: number; lng: number } | null;
  address: { formatted_address: string; details: string | null; lat: number; lng: number } | null;
  courier_id: string | null;
  items: Array<{
    id: string;
    name_snapshot: string;
    price_snapshot: number;
    unit_snapshot: ProductUnit;
    quantity: number;
    subtotal: number;
  }>;
}

// Slow polling as a safety net; realtime gives us instant updates.
const POLL_INTERVAL_MS = 30_000;
const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

export function TrackingClient({ code }: { code: string }) {
  const t = useTranslations('track');
  const tc = useTranslations('currency');
  const locale = useLocale();

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/by-code/${code}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setOrder(data.order);
    } catch {
      // Silent — keep last known order
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Realtime subscription — refetch on any update to this order
  useRealtimeOrder({
    orderId: order?.id ?? null,
    onChange: fetchOrder,
  });

  // Slow poll fallback (covers realtime drops + connection blips)
  useEffect(() => {
    if (!order || TERMINAL_STATUSES.includes(order.status)) return;
    const id = setInterval(fetchOrder, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [order, fetchOrder]);

  if (loading) {
    return (
      <div className="px-5 py-12 flex items-center justify-center">
        <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="px-8 py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-500">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="font-serif text-[20px] text-cream-100">{t('notFound')}</h1>
        <p className="text-[12px] text-cream-100/55 mt-1 font-mono">{code}</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-2 space-y-4 pb-12">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-serif text-[22px] text-cream-100 leading-tight">{t('title')}</h1>
        <p className="text-[11px] text-cream-100/45 mt-0.5 font-mono">{order.public_code}</p>
      </div>

      {/* ETA */}
      {order.delivery_eta_minutes !== null && !TERMINAL_STATUSES.includes(order.status) && (
        <div className="surface rounded-2xl border border-fig-600/[0.12] p-4 shadow-card animate-fade-up">
          <div className="text-[11px] text-cream-100/45 mb-1">{t('estimatedArrival')}</div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[28px] text-gold-300 leading-none">
              {(order.prep_eta_minutes ?? 0) + (order.delivery_eta_minutes ?? 0)}
            </span>
            <span className="text-[13px] text-cream-100/55">{t('minutes')}</span>
          </div>
        </div>
      )}

      {/* Payment block (only if pending) */}
      <PaymentBlock
        publicCode={order.public_code}
        paymentMethod={order.payment_method}
        paymentStatus={order.payment_status}
        orderStatus={order.status}
        amount={order.total}
        somLabel={tc('som')}
        onConfirmed={fetchOrder}
      />

      {/* Timeline */}
      <div className="surface rounded-2xl border border-gold-300/10 p-5 shadow-card">
        <StatusTimeline status={order.status} />
      </div>

      {/* Live courier map — only when courier is assigned and order is in transit */}
      {order.courier_id &&
        order.address?.lat &&
        order.address?.lng &&
        ['courier_assigned', 'picked_up'].includes(order.status) && (
          <div>
            <div className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-2 px-1">
              {t('courierOnMap')}
            </div>
            <LiveCourierMap
              courierId={order.courier_id}
              destLat={order.status === 'picked_up' ? order.address.lat : order.store?.lat ?? order.address.lat}
              destLng={order.status === 'picked_up' ? order.address.lng : order.store?.lng ?? order.address.lng}
            />
          </div>
        )}

      {/* Items */}
      <div className="surface rounded-2xl border border-gold-300/10 shadow-card overflow-hidden">
        <div className="px-4 py-2.5 bg-forest-700/50 border-b border-gold-300/10">
          <div className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase">
            {t('items')}
          </div>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {order.items.map((item) => (
            <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-cream-100">{item.name_snapshot}</div>
                <div className="text-[11px] text-cream-100/55">
                  {item.quantity}
                  {(item.unit_snapshot === 'kg' || item.unit_snapshot === 'gram') && ' кг'}
                  {' × '}
                  {formatSom(item.price_snapshot)} {tc('som')}
                </div>
              </div>
              <div className="text-[13px] text-cream-100 tabular-nums shrink-0">
                {formatSom(item.subtotal)} {tc('som')}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-forest-700/30 border-t border-gold-300/10 space-y-1">
          <Row label={t('subtotal')} value={`${formatSom(order.subtotal)} ${tc('som')}`} muted />
          <Row label={t('delivery')} value={Number(order.delivery_fee) === 0 ? '—' : `${formatSom(order.delivery_fee)} ${tc('som')}`} muted />
          <Row label={t('total')} value={`${formatSom(order.total)} ${tc('som')}`} bold />
        </div>
      </div>

      {/* Delivery address */}
      {order.address && (
        <div className="surface rounded-2xl border border-gold-300/10 p-4 shadow-card">
          <div className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase mb-1.5">
            {t('deliveryAddress')}
          </div>
          <div className="text-[13px] text-cream-100">{order.address.formatted_address}</div>
          {order.address.details && (
            <div className="text-[11px] text-cream-100/55 mt-0.5">{order.address.details}</div>
          )}
        </div>
      )}

      {/* Store call button — only rendered when the store has a phone number */}
      {order.store && (order.store as { phone?: string }).phone && (
        <a
          href={`tel:${(order.store as { phone?: string }).phone}`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface shadow-card hover:border-fig-600/30 transition-colors text-gold-300 text-[13px] font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          {t('callStore')}
        </a>
      )}
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[12px] ${muted ? 'text-cream-100/55' : 'text-cream-100'}`}>{label}</span>
      <span
        className={`tabular-nums ${
          bold ? 'text-[15px] font-medium text-cream-100' : 'text-[12px] text-cream-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
