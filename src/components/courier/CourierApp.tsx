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
      <div className="min-h-dvh flex items-center justify-center">
        <span className="inline-block w-6 h-6 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      {/* Top bar — always visible */}
      <header className="flex items-center justify-between px-5 h-14 bg-white border-b border-black/[0.06]">
        <div className="font-serif text-fig-600 text-[18px] tracking-[0.08em]">Colibri</div>
        <div className="flex items-center gap-3">
          <StatusBadge status={state.courier.status} />
          <button onClick={logout} className="text-[12px] text-ink-muted hover:text-red-600">
            Выход
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[12px] text-red-700">
          {error}
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
        <CourierHistory history={state.history} />
      )}
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
            <div key={h.id} className="bg-white rounded-xl border border-black/[0.05] px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-ink-faint">{h.public_code}</span>
                  <span className="text-[10px] text-green-700">✓ Доставлен</span>
                </div>
                <div className="text-[13px] text-ink-soft truncate mt-0.5">
                  {h.vertical === 'parcel' ? 'Посылка' : h.customer_name}
                </div>
                {when && <div className="text-[10px] text-ink-muted mt-0.5">{when}</div>}
              </div>
              <div className="text-[14px] font-medium text-fig-800 tabular-nums shrink-0">
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
    offline: { label: 'Не на смене', color: 'bg-ink-faint/20 text-ink-muted' },
    online: { label: 'На смене', color: 'bg-green-100 text-green-800' },
    on_delivery: { label: 'В пути', color: 'bg-fig-50 text-fig-700' },
  }[status];
  return (
    <span className={`text-[11px] font-medium px-2 py-1 rounded-md tracking-wide ${config.color}`}>
      {config.label}
    </span>
  );
}

function OfflineView({ onGoOnline, actionInFlight }: { onGoOnline: () => void; actionInFlight: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-fig-50 flex items-center justify-center text-fig-600 mb-5">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7c0 5-7 13-7 13S5 12 5 7a7 7 0 0 1 14 0Z" />
          <circle cx="12" cy="7" r="2.5" />
        </svg>
      </div>
      <h1 className="font-serif text-[24px] text-ink-soft mb-2">Готовы выйти на смену?</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-[280px] mb-8">
        Мы определим ваше местоположение и начнём предлагать вам заказы поблизости
      </p>
      <button
        onClick={onGoOnline}
        disabled={actionInFlight}
        className="w-full max-w-[280px] btn-fig text-white py-4 rounded-2xl font-medium text-[16px] disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {actionInFlight ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          'Выйти на смену'
        )}
      </button>
    </div>
  );
}

function IdleView({ onGoOffline, actionInFlight }: { onGoOffline: () => void; actionInFlight: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center text-green-700 mb-5 relative">
        <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-40" />
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <h1 className="font-serif text-[22px] text-ink-soft mb-2">Ожидаем заказ</h1>
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-[280px] mb-12">
        Не закрывайте страницу. Когда поступит заказ — вы услышите сигнал и сможете принять его
      </p>
      <button
        onClick={onGoOffline}
        disabled={actionInFlight}
        className="text-[13px] text-ink-muted hover:text-red-600 disabled:opacity-50 underline-offset-4 hover:underline"
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

  return (
    <div className="flex-1 flex flex-col">
      {/* Pulsing header */}
      <div className="bg-fig-600 text-white px-5 py-3.5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[1.4px] opacity-80">Новый заказ</div>
          <div className="font-mono text-[13px]">{order.public_code}</div>
        </div>
        <div className="text-right">
          <div className="font-serif text-[26px] tabular-nums leading-none">{secondsLeft}</div>
          <div className="text-[10px] opacity-80">секунд</div>
        </div>
      </div>
      <div className="h-1 bg-fig-700">
        <div
          className="h-full bg-white transition-all"
          style={{ width: `${pct}%`, transitionDuration: '250ms' }}
        />
      </div>

      {/* Order details */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
      <div className="px-5 py-4 border-t border-black/[0.06] safe-bottom bg-white grid grid-cols-3 gap-2">
        <button
          onClick={onReject}
          disabled={actionInFlight}
          className="col-span-1 py-3.5 rounded-xl border border-ink-faint/30 text-ink-muted font-medium text-[14px] disabled:opacity-50"
        >
          Пропустить
        </button>
        <button
          onClick={onAccept}
          disabled={actionInFlight}
          className="col-span-2 py-3.5 rounded-xl btn-fig text-white font-medium text-[15px] disabled:opacity-70 flex items-center justify-center gap-2"
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
      <div className="bg-white px-5 py-3 border-b border-black/[0.06]">
        <div className="font-mono text-[11px] text-ink-subtle">
          {order.public_code} {isParcel && <span className="text-fig-700">· Посылка</span>}
        </div>
        <div className="text-[16px] font-medium text-ink-soft">
          {stage === 'pickup'
            ? isParcel
              ? 'Заберите у отправителя'
              : 'Заберите заказ'
            : isParcel
            ? 'Передайте получателю'
            : 'Доставьте клиенту'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
                className="inline-flex items-center gap-1.5 mt-3 text-[12px] text-fig-700 font-medium"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                className="inline-flex items-center gap-1.5 mt-3 text-[12px] text-fig-700 font-medium"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      <div className="px-5 py-4 border-t border-black/[0.06] safe-bottom bg-white">
        {stage === 'pickup' ? (
          <button
            onClick={onPickedUp}
            disabled={actionInFlight}
            className="w-full py-4 rounded-2xl btn-fig text-white font-medium text-[16px] disabled:opacity-70"
          >
            Я забрал заказ
          </button>
        ) : (
          <button
            onClick={onDelivered}
            disabled={actionInFlight}
            className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-medium text-[16px] disabled:opacity-70 transition-colors"
          >
            Заказ доставлен
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`p-4 rounded-2xl border ${
        highlight
          ? 'bg-white border-fig-600/30 shadow-card'
          : 'bg-white border-black/[0.06]'
      }`}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-1.5">
      {children}
    </div>
  );
}

function StageStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
          done
            ? 'bg-green-600 text-white'
            : active
            ? 'bg-fig-600 text-white'
            : 'bg-black/[0.08] text-ink-faint'
        }`}
      >
        {done ? '✓' : ''}
      </div>
      <span
        className={`text-[11px] ${
          active ? 'text-ink-soft font-medium' : done ? 'text-ink-muted' : 'text-ink-faint'
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
