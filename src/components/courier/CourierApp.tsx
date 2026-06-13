'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';

interface HistoryOrder {
  id: string;
  public_code: string;
  status: string;
  total: number;
  vertical: string | null;
  delivered_at: string | null;
  customer_name: string;
}

interface CourierState {
  courier: { status: 'offline' | 'online' | 'on_delivery'; lastLat?: number; lastLng?: number };
  offer: OfferData | null;
  activeOrder: ActiveOrder | null;
  history: HistoryOrder[];
}

interface ParcelDetails {
  contents_category: 'documents' | 'small' | 'medium' | 'large';
  contents_description: string | null;
  weight: 'light' | 'heavy';
  pickup_name: string;
  pickup_phone: string;
  dropoff_name: string;
  dropoff_phone: string;
}

interface OfferData {
  id: string;
  orderId: string;
  expiresAt: string;
  distanceKm: number | null;
  order: {
    public_code: string;
    customer_name: string;
    customer_phone: string;
    total: number;
    payment_method: string;
    notes: string | null;
    subtotal: number;
    delivery_fee: number;
    vertical: 'fruits' | 'parcel' | string;
    parcel_details: ParcelDetails | null;
    cash_payer: 'sender' | 'recipient' | null;
    store: { name: string; address: string | null; lat: number; lng: number } | null;
    address: { formatted_address: string; details: string | null; lat: number; lng: number } | null;
    pickup_address: { formatted_address: string; details: string | null; lat: number; lng: number } | null;
    items: Array<{ name_snapshot: string; quantity: number; unit_snapshot: string }>;
  };
}

interface ActiveOrder {
  id: string;
  public_code: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  payment_method: string;
  notes: string | null;
  vertical: 'fruits' | 'parcel' | string;
  parcel_details: ParcelDetails | null;
  cash_payer: 'sender' | 'recipient' | null;
  store: { name: string; address: string | null; lat: number; lng: number } | null;
  address: { formatted_address: string; details: string | null; lat: number; lng: number } | null;
  pickup_address: { formatted_address: string; details: string | null; lat: number; lng: number } | null;
  items: Array<{ name_snapshot: string; quantity: number; unit_snapshot: string }>;
}

const PING_INTERVAL_ONLINE_MS = 45_000;
const PING_INTERVAL_DELIVERY_MS = 15_000;
const STATE_POLL_MS = 30_000; // fallback polling — realtime should beat this

export function CourierApp({ courierUserId }: { courierUserId: string }) {
  const [state, setState] = useState<CourierState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPingAtRef = useRef<number>(0);
  const router = useRouter();

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/courier/state', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + slow fallback poll
  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, STATE_POLL_MS);
    return () => clearInterval(id);
  }, [fetchState]);

  // Realtime: refresh state on any change to this courier's offers or their courier row
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const offerChannel = supabase
      .channel(`courier-offers:${courierUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_offers',
          filter: `courier_id=eq.${courierUserId}`,
        },
        () => fetchState(),
      )
      .subscribe();

    const courierChannel = supabase
      .channel(`courier-self:${courierUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: `user_id=eq.${courierUserId}`,
        },
        () => fetchState(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(offerChannel);
      supabase.removeChannel(courierChannel);
    };
  }, [courierUserId, fetchState]);

  // GPS pinger
  useEffect(() => {
    if (!state || state.courier.status === 'offline') return;
    const interval = state.courier.status === 'on_delivery'
      ? PING_INTERVAL_DELIVERY_MS
      : PING_INTERVAL_ONLINE_MS;

    let timer: ReturnType<typeof setInterval>;
    function doPing() {
      if (!navigator.geolocation) return;
      // Don't ping twice in a row too quickly
      if (Date.now() - lastPingAtRef.current < 5000) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastPingAtRef.current = Date.now();
          fetch('/api/staff/courier/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
      );
    }

    doPing(); // ping immediately
    timer = setInterval(doPing, interval);
    return () => clearInterval(timer);
  }, [state]);

  // ============================================================
  // Actions
  // ============================================================

  async function goOnline() {
    setError(null);
    setActionInFlight(true);

    // Best-effort: try to attach GPS coords, but never block going on shift
    // if the browser denies or can't resolve location. Orders still reach
    // online couriers; coords just improve distance sorting when present.
    const sendOnline = async (coords?: { lat: number; lng: number }) => {
      const res = await fetch('/api/staff/courier/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords ?? {}),
      });
      setActionInFlight(false);
      if (res.ok) {
        await fetchState();
      } else {
        setError('Не удалось выйти на смену. Попробуйте ещё раз.');
      }
    };

    if (!navigator.geolocation) {
      await sendOnline();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => sendOnline({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      // GPS failed or denied — go online anyway without coords
      () => sendOnline(),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function goOffline() {
    setError(null);
    setActionInFlight(true);
    const res = await fetch('/api/staff/courier/offline', { method: 'POST' });
    setActionInFlight(false);
    if (res.ok) {
      await fetchState();
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'has_active_delivery') {
        setError('Сначала завершите текущую доставку');
      } else {
        setError('Не удалось завершить смену');
      }
    }
  }

  async function acceptOffer(offerId: string) {
    setActionInFlight(true);
    const res = await fetch(`/api/staff/offers/${offerId}/accept`, { method: 'POST' });
    setActionInFlight(false);
    if (res.ok) {
      await fetchState();
    } else {
      setError('Заказ уже взят другим курьером');
      await fetchState();
    }
  }

  async function rejectOffer(offerId: string) {
    setActionInFlight(true);
    await fetch(`/api/staff/offers/${offerId}/reject`, { method: 'POST' });
    setActionInFlight(false);
    await fetchState();
  }

  async function expireOffer(offerId: string) {
    await fetch(`/api/staff/offers/${offerId}/expire`, { method: 'POST' });
    await fetchState();
  }

  async function markPickedUp(orderId: string) {
    setActionInFlight(true);
    const res = await fetch(`/api/staff/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'picked_up' }),
    });
    setActionInFlight(false);
    if (res.ok) await fetchState();
  }

  async function markDelivered(orderId: string) {
    setActionInFlight(true);
    const res = await fetch(`/api/staff/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });
    setActionInFlight(false);
    if (res.ok) await fetchState();
  }

  async function logout() {
    await fetch('/api/staff/logout', { method: 'POST' });
    window.location.assign('/staff/login');
  }

  // ============================================================
  // Render
  // ============================================================

  if (loading || !state) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-[#F6F4EE] to-[#E8E2D6]">
        <span className="inline-block w-6 h-6 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#F6F4EE] via-[#F1EDE4] to-[#E8E2D6]">
      <div className="min-h-dvh flex flex-col max-w-md mx-auto w-full">
      {/* Top bar — always visible */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 h-16 bg-white/80 backdrop-blur-md border-b border-black/[0.05] shadow-soft">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-xl bg-fig-600 flex items-center justify-center shadow-fig-glow">
            <span className="w-2 h-2 rounded-full bg-gold-300" />
          </span>
          <span className="font-serif text-fig-700 text-[19px] tracking-[0.06em]">Colibri</span>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusBadge status={state.courier.status} />
          <button
            onClick={logout}
            aria-label="Выход"
            className="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700 shadow-soft animate-fade-in">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* State-driven main content */}
      {state.activeOrder ? (
        <DeliveryView
          order={state.activeOrder}
          onPickedUp={() => markPickedUp(state.activeOrder!.id)}
          onDelivered={() => markDelivered(state.activeOrder!.id)}
          actionInFlight={actionInFlight}
        />
      ) : state.offer ? (
        <OfferView
          offer={state.offer}
          onAccept={() => acceptOffer(state.offer!.id)}
          onReject={() => rejectOffer(state.offer!.id)}
          onExpire={() => expireOffer(state.offer!.id)}
          actionInFlight={actionInFlight}
        />
      ) : state.courier.status === 'online' ? (
        <IdleView onGoOffline={goOffline} actionInFlight={actionInFlight} />
      ) : (
        <OfflineView onGoOnline={goOnline} actionInFlight={actionInFlight} />
      )}

      {/* Delivery history — persists after each completed order */}
      {!state.activeOrder && !state.offer && state.history.length > 0 && (
        <div className="px-5 pb-8">
          <CourierHistory history={state.history} />
        </div>
      )}
      </div>
    </div>
  );
}

function CourierHistory({ history }: { history: HistoryOrder[] }) {
  const todayCount = history.filter((h) => {
    if (!h.delivered_at) return false;
    const d = new Date(h.delivered_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h3 className="text-[12px] font-medium text-ink-subtle tracking-[1.2px] uppercase">
          История доставок
        </h3>
        {todayCount > 0 && (
          <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
            Сегодня: {todayCount}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {history.map((h) => {
          const when = h.delivered_at
            ? new Date(h.delivered_at).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '';
          return (
            <div key={h.id} className="bg-white rounded-2xl border border-black/[0.04] shadow-soft px-4 py-3 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-ink-faint">{h.public_code}</span>
                  {when && <span className="text-[10px] text-ink-muted">· {when}</span>}
                </div>
                <div className="text-[13px] font-medium text-ink-soft truncate mt-0.5">
                  {h.vertical === 'parcel' ? 'Посылка' : h.customer_name}
                </div>
              </div>
              <div className="text-[14px] font-semibold text-fig-800 tabular-nums shrink-0">
                {h.total} <span className="text-[10px] text-ink-muted font-normal">сом</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================
// Sub-views
// ================================================================

function StatusBadge({ status }: { status: 'offline' | 'online' | 'on_delivery' }) {
  const config = {
    offline: { label: 'Не на смене', pill: 'bg-ink-faint/15 text-ink-muted', dot: 'bg-ink-faint', live: false },
    online: { label: 'На смене', pill: 'bg-green-100 text-green-800', dot: 'bg-green-500', live: true },
    on_delivery: { label: 'В пути', pill: 'bg-fig-50 text-fig-700', dot: 'bg-fig-600', live: true },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide ${config.pill}`}>
      <span className="relative flex w-1.5 h-1.5">
        {config.live && (
          <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${config.dot}`} />
        )}
        <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${config.dot}`} />
      </span>
      {config.label}
    </span>
  );
}

function OfflineView({ onGoOnline, actionInFlight }: { onGoOnline: () => void; actionInFlight: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-up">
      <div className="w-28 h-28 rounded-full bg-gradient-to-b from-fig-50 to-white flex items-center justify-center text-fig-600 mb-6 shadow-card ring-1 ring-fig-600/10">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7c0 5-7 13-7 13S5 12 5 7a7 7 0 0 1 14 0Z" />
          <circle cx="12" cy="7" r="2.5" />
        </svg>
      </div>
      <h1 className="font-serif text-[25px] text-ink-soft mb-2">Готовы выйти на смену?</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-[280px] mb-9">
        Мы определим ваше местоположение и начнём предлагать вам заказы поблизости
      </p>
      <button
        onClick={onGoOnline}
        disabled={actionInFlight}
        className="w-full max-w-[300px] btn-fig text-white py-4 rounded-2xl font-semibold text-[16px] disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {actionInFlight ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            Выйти на смену
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

function IdleView({ onGoOffline, actionInFlight }: { onGoOffline: () => void; actionInFlight: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-up">
      <div className="w-28 h-28 rounded-full bg-gradient-to-b from-green-50 to-white flex items-center justify-center text-green-700 mb-6 relative shadow-card ring-1 ring-green-600/10">
        <span className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
        <span className="absolute inset-3 rounded-full bg-green-400/10 animate-ping" style={{ animationDelay: '0.4s' }} />
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <h1 className="font-serif text-[23px] text-ink-soft mb-2">Ожидаем заказ</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-[280px] mb-10">
        Не закрывайте страницу. Когда поступит заказ — вы услышите сигнал и сможете принять его
      </p>
      <button
        onClick={onGoOffline}
        disabled={actionInFlight}
        className="px-5 py-2.5 rounded-full bg-white border border-black/[0.08] text-[13px] font-medium text-ink-muted hover:text-red-600 hover:border-red-200 shadow-soft transition-colors disabled:opacity-50"
      >
        Завершить смену
      </button>
    </div>
  );
}

function OfferView({
  offer,
  onAccept,
  onReject,
  onExpire,
  actionInFlight,
}: {
  offer: OfferData;
  onAccept: () => void;
  onReject: () => void;
  onExpire: () => void;
  actionInFlight: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    return Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000));
  });
  const expiredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 250);
    return () => clearInterval(id);
  }, [offer.expiresAt, onExpire]);

  const order = offer.order;
  const itemCount = order.items.length;
  const pct = Math.max(0, Math.min(100, (secondsLeft / 15) * 100));

  const ring = 2 * Math.PI * 22;

  return (
    <div className="flex-1 flex flex-col">
      {/* Pulsing header with circular countdown */}
      <div className="relative bg-gradient-to-br from-fig-600 via-fig-700 to-fig-800 text-white px-5 pt-4 pb-5 overflow-hidden">
        <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[1.4px] bg-white/15 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulse" />
              Новый заказ
            </div>
            <div className="font-mono text-[13px] mt-2 opacity-90">{order.public_code}</div>
            <div className="font-serif text-[28px] tabular-nums leading-tight mt-1">
              {Number(order.total).toFixed(0)} <span className="text-[15px] opacity-80">сом</span>
            </div>
          </div>
          <div className="relative w-[56px] h-[56px] shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
              <circle
                cx="25" cy="25" r="22" fill="none" stroke="#C8F169" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 250ms linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-serif text-[20px] tabular-nums">
              {secondsLeft}
            </div>
          </div>
        </div>
      </div>

      {/* Order details */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {order.vertical === 'parcel' ? (
          <ParcelOfferCards order={order} distanceKm={offer.distanceKm} />
        ) : (
          <>
            <Card>
              <CardLabel>Магазин</CardLabel>
              <div className="text-[15px] font-medium text-ink-soft">
                {order.store?.name ?? 'Магазин'}
              </div>
              {order.store?.address && (
                <div className="text-[12px] text-ink-muted mt-0.5">{order.store.address}</div>
              )}
              {offer.distanceKm !== null && (
                <div className="text-[11px] text-fig-700 mt-1.5">
                  {offer.distanceKm.toFixed(1)} км от вас
                </div>
              )}
            </Card>

            <Card>
              <CardLabel>Доставка</CardLabel>
              <div className="text-[14px] font-medium text-ink-soft">{order.customer_name}</div>
              {order.address?.formatted_address && (
                <div className="text-[13px] text-ink-soft mt-0.5">{order.address.formatted_address}</div>
              )}
              {order.address?.details && (
                <div className="text-[11px] text-ink-muted mt-0.5">{order.address.details}</div>
              )}
            </Card>

            <Card>
              <CardLabel>Состав · {itemCount} поз.</CardLabel>
              <div className="space-y-0.5">
                {order.items.map((item, i) => (
                  <div key={i} className="text-[13px] text-ink-soft">
                    {item.name_snapshot} <span className="text-ink-muted">× {item.quantity}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        <Card>
          <CardLabel>{order.vertical === 'parcel' ? 'Стоимость доставки' : 'Сумма заказа'}</CardLabel>
          <div className="text-[20px] font-medium text-ink-soft tabular-nums">
            {Number(order.total).toFixed(0)} сом
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5">
            {order.payment_method === 'cash'
              ? order.vertical === 'parcel'
                ? order.cash_payer === 'recipient'
                  ? 'Наличные у получателя'
                  : 'Наличные у отправителя'
                : 'Наличные при получении'
              : 'Оплата онлайн'}
          </div>
        </Card>
      </div>

      {/* Action bar */}
      <div className="px-5 py-4 border-t border-black/[0.05] safe-bottom bg-white/90 backdrop-blur-md grid grid-cols-3 gap-2.5">
        <button
          onClick={onReject}
          disabled={actionInFlight}
          className="col-span-1 py-3.5 rounded-2xl bg-cream border border-black/[0.08] text-ink-muted font-medium text-[14px] hover:bg-black/[0.03] transition-colors disabled:opacity-50"
        >
          Пропустить
        </button>
        <button
          onClick={onAccept}
          disabled={actionInFlight}
          className="col-span-2 py-3.5 rounded-2xl btn-fig text-white font-semibold text-[15px] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {actionInFlight ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Принять · {Number(order.total).toFixed(0)} сом</>
          )}
        </button>
      </div>
    </div>
  );
}

function DeliveryView({
  order,
  onPickedUp,
  onDelivered,
  actionInFlight,
}: {
  order: ActiveOrder;
  onPickedUp: () => void;
  onDelivered: () => void;
  actionInFlight: boolean;
}) {
  const stage = order.status === 'picked_up' ? 'dropoff' : 'pickup';
  const isParcel = order.vertical === 'parcel';

  // Pick the right coords / labels per vertical
  const pickup = isParcel
    ? {
        name: order.parcel_details?.pickup_name ?? '',
        phone: order.parcel_details?.pickup_phone ?? '',
        address: order.pickup_address?.formatted_address,
        details: order.pickup_address?.details,
        lat: order.pickup_address?.lat,
        lng: order.pickup_address?.lng,
      }
    : {
        name: order.store?.name ?? 'Магазин',
        phone: undefined as string | undefined,
        address: order.store?.address,
        details: undefined as string | null | undefined,
        lat: order.store?.lat,
        lng: order.store?.lng,
      };

  const dropoff = isParcel
    ? {
        name: order.parcel_details?.dropoff_name ?? '',
        phone: order.parcel_details?.dropoff_phone ?? '',
        address: order.address?.formatted_address,
        details: order.address?.details,
        lat: order.address?.lat,
        lng: order.address?.lng,
      }
    : {
        name: order.customer_name,
        phone: order.customer_phone,
        address: order.address?.formatted_address,
        details: order.address?.details,
        lat: order.address?.lat,
        lng: order.address?.lng,
      };

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white/90 backdrop-blur-md px-5 py-3.5 border-b border-black/[0.05] shadow-soft">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-subtle">{order.public_code}</span>
          {isParcel && (
            <span className="text-[10px] font-semibold text-fig-700 bg-fig-50 px-2 py-0.5 rounded-full">Посылка</span>
          )}
        </div>
        <div className="text-[17px] font-semibold text-ink-soft mt-0.5">
          {stage === 'pickup'
            ? isParcel
              ? 'Заберите у отправителя'
              : 'Заберите заказ'
            : isParcel
            ? 'Передайте получателю'
            : 'Доставьте клиенту'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Stage indicator */}
        <div className="flex items-center gap-2">
          <StageStep
            label={isParcel ? 'Отправитель' : 'К магазину'}
            active={stage === 'pickup'}
            done={stage === 'dropoff'}
          />
          <div className="flex-1 h-px bg-black/[0.08]" />
          <StageStep
            label={isParcel ? 'Получатель' : 'К клиенту'}
            active={stage === 'dropoff'}
            done={false}
          />
        </div>

        {stage === 'pickup' ? (
          <Card highlight>
            <CardLabel>{isParcel ? 'Отправитель' : 'Забрать в магазине'}</CardLabel>
            <div className="text-[16px] font-medium text-ink-soft">{pickup.name}</div>
            {pickup.phone && (
              <a href={`tel:${pickup.phone}`} className="text-[13px] text-fig-700 font-medium block mt-0.5">
                {pickup.phone}
              </a>
            )}
            {pickup.address && (
              <div className="text-[13px] text-ink-soft mt-1">{pickup.address}</div>
            )}
            {pickup.details && (
              <div className="text-[11px] text-ink-muted mt-0.5">{pickup.details}</div>
            )}
            {pickup.lat && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${pickup.lat},${pickup.lng}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl bg-fig-50 text-fig-700 text-[12px] font-semibold hover:bg-fig-600 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Открыть в картах
              </a>
            )}
          </Card>
        ) : (
          <Card highlight>
            <CardLabel>{isParcel ? 'Получатель' : 'Доставить клиенту'}</CardLabel>
            <div className="text-[16px] font-medium text-ink-soft">{dropoff.name}</div>
            {dropoff.phone && (
              <a href={`tel:${dropoff.phone}`} className="text-[13px] text-fig-700 font-medium">
                {dropoff.phone}
              </a>
            )}
            {dropoff.address && (
              <div className="text-[13px] text-ink-soft mt-1">{dropoff.address}</div>
            )}
            {dropoff.details && (
              <div className="text-[11px] text-ink-muted mt-0.5">{dropoff.details}</div>
            )}
            {dropoff.lat && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${dropoff.lat},${dropoff.lng}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl bg-fig-50 text-fig-700 text-[12px] font-semibold hover:bg-fig-600 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Открыть в картах
              </a>
            )}
          </Card>
        )}

        {isParcel ? (
          <Card>
            <CardLabel>Содержимое</CardLabel>
            <div className="text-[14px] text-ink-soft">
              {parcelCategoryLabel(order.parcel_details?.contents_category)}
              <span className="text-ink-muted">
                {' '}· {order.parcel_details?.weight === 'heavy' ? 'до 15 кг' : 'до 5 кг'}
              </span>
            </div>
            {order.parcel_details?.contents_description && (
              <div className="text-[12px] text-ink-muted mt-1">{order.parcel_details.contents_description}</div>
            )}
          </Card>
        ) : (
          <Card>
            <CardLabel>Состав</CardLabel>
            <div className="space-y-0.5">
              {order.items.map((item, i) => (
                <div key={i} className="text-[13px] text-ink-soft">
                  {item.name_snapshot} <span className="text-ink-muted">× {item.quantity}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardLabel>К оплате</CardLabel>
          <div className="text-[20px] font-medium text-ink-soft tabular-nums">
            {Number(order.total).toFixed(0)} сом
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5">
            {order.payment_method === 'cash'
              ? isParcel
                ? order.cash_payer === 'recipient'
                  ? 'Получите у получателя'
                  : 'Получите у отправителя'
                : 'Получите наличными'
              : 'Уже оплачено онлайн'}
          </div>
        </Card>

        {order.notes && (
          <Card>
            <CardLabel>Комментарий</CardLabel>
            <div className="text-[13px] text-ink-soft">{order.notes}</div>
          </Card>
        )}
      </div>

      <div className="px-5 py-4 border-t border-black/[0.05] safe-bottom bg-white/90 backdrop-blur-md">
        {stage === 'pickup' ? (
          <button
            onClick={onPickedUp}
            disabled={actionInFlight}
            className="w-full py-4 rounded-2xl btn-fig text-white font-semibold text-[16px] disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {actionInFlight ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7Z" />
                  <path d="M9 7V5a3 3 0 0 1 6 0v2" />
                </svg>
                Я забрал заказ
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onDelivered}
            disabled={actionInFlight}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold text-[16px] disabled:opacity-70 transition-colors shadow-lg shadow-green-600/25 flex items-center justify-center gap-2"
          >
            {actionInFlight ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Заказ доставлен
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`p-4 rounded-2xl ${
        highlight
          ? 'bg-white ring-1 ring-fig-600/20 shadow-card border-l-[3px] border-l-fig-600'
          : 'bg-white border border-black/[0.05] shadow-soft'
      }`}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-subtle tracking-[1.4px] uppercase mb-1.5">
      <span className="w-1 h-1 rounded-full bg-gold-400" />
      {children}
    </div>
  );
}

function StageStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
          done
            ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
            : active
            ? 'bg-fig-600 text-white shadow-sm shadow-fig-600/30 ring-2 ring-fig-600/15'
            : 'bg-black/[0.06] text-ink-faint'
        }`}
      >
        {done ? '✓' : active ? '•' : ''}
      </div>
      <span
        className={`text-[11px] ${
          active ? 'text-ink-soft font-semibold' : done ? 'text-ink-muted' : 'text-ink-faint'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function parcelCategoryLabel(cat?: string): string {
  switch (cat) {
    case 'documents': return 'Документы';
    case 'small': return 'Маленький пакет';
    case 'medium': return 'Средняя посылка';
    case 'large': return 'Большая посылка';
    default: return 'Посылка';
  }
}

function ParcelOfferCards({
  order,
  distanceKm,
}: {
  order: OfferData['order'];
  distanceKm: number | null;
}) {
  const pickup = order.pickup_address;
  const dropoff = order.address;
  return (
    <>
      <Card>
        <CardLabel>Забрать у отправителя</CardLabel>
        <div className="text-[15px] font-medium text-ink-soft">
          {order.parcel_details?.pickup_name ?? '—'}
        </div>
        {pickup?.formatted_address && (
          <div className="text-[12px] text-ink-soft mt-1">{pickup.formatted_address}</div>
        )}
        {distanceKm !== null && (
          <div className="text-[11px] text-fig-700 mt-1.5">
            {distanceKm.toFixed(1)} км от вас
          </div>
        )}
      </Card>

      <Card>
        <CardLabel>Передать получателю</CardLabel>
        <div className="text-[15px] font-medium text-ink-soft">
          {order.parcel_details?.dropoff_name ?? '—'}
        </div>
        {dropoff?.formatted_address && (
          <div className="text-[12px] text-ink-soft mt-1">{dropoff.formatted_address}</div>
        )}
      </Card>

      <Card>
        <CardLabel>Содержимое</CardLabel>
        <div className="text-[13px] text-ink-soft">
          {parcelCategoryLabel(order.parcel_details?.contents_category)}
          <span className="text-ink-muted">
            {' '}· {order.parcel_details?.weight === 'heavy' ? 'до 15 кг' : 'до 5 кг'}
          </span>
        </div>
        {order.parcel_details?.contents_description && (
          <div className="text-[12px] text-ink-muted mt-1">
            {order.parcel_details.contents_description}
          </div>
        )}
      </Card>
    </>
  );
}
