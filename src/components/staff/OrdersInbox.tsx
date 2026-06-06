'use client';

import { useEffect, useRef, useState } from 'react';
import { useNewOrderNotifier } from './useNewOrderNotifier';
import { useRealtimeOrders } from '@/lib/realtime/useRealtimeOrders';
import type { OrderStatus, PaymentMethod, ProductUnit } from '@/lib/types';

// Realtime gives us instant updates; this poll is just a safety net
// in case the WebSocket drops or realtime isn't enabled on the project.
const POLL_MS = 30_000;

interface InboxOrder {
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
  store_id: string;
  courier_id: string | null;
  vertical?: string | null;
  address: { formatted_address: string; details: string | null } | null;
  items: Array<{
    id: string;
    name_snapshot: string;
    price_snapshot: number;
    unit_snapshot: ProductUnit;
    quantity: number;
    subtotal: number;
  }>;
  store?: { id: string; name: string };
}

interface Props {
  showStoreName?: boolean; // operator dashboard shows the store name on each card
  storeId?: string | null; // store_owner: filter realtime by store; operator: omit
  allowManualAssign?: boolean; // operator/admin can manually assign couriers
}

export function OrdersInbox({ showStoreName = false, storeId = null, allowManualAssign = false }: Props) {
  const [orders, setOrders] = useState<InboxOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<InboxOrder | null>(null);
  const seenOrderIds = useRef<Set<string>>(new Set());
  const firstFetch = useRef(true);
  const { audioEnabled, enableAudio, notifyNewOrders } = useNewOrderNotifier();

  async function fetchOrders() {
    try {
      const res = await fetch('/api/staff/orders', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const fetched: InboxOrder[] = data.orders ?? [];

      // Detect newly placed orders (status === 'placed' and not seen before)
      const currentIds = new Set(fetched.map((o) => o.id));
      const newPlacedOrders = fetched.filter(
        (o) => o.status === 'placed' && !seenOrderIds.current.has(o.id),
      );
      if (!firstFetch.current && newPlacedOrders.length > 0) {
        notifyNewOrders(newPlacedOrders.length);
      }
      seenOrderIds.current = currentIds;
      firstFetch.current = false;

      setOrders(fetched);
    } catch {
      // Silent — keep last state
    } finally {
      setLoading(false);
    }
  }

  // Realtime: refetch immediately when any relevant order row changes
  useRealtimeOrders({
    storeId,
    onChange: () => {
      fetchOrders();
    },
  });

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function transition(orderId: string, status: 'accepted' | 'ready' | 'cancelled') {
    try {
      const res = await fetch(`/api/staff/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        // Optimistically update the open drawer so it reflects the new status immediately.
        // (We can't rely on `orders` in this closure — it's stale until React re-renders.)
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status });
        }
        // Then refresh the list from the server
        await fetchOrders();
      }
    } catch {
      // ignore
    }
  }

  const newOrders = orders.filter((o) => o.status === 'placed' || o.status === 'pending_payment');
  const inProgress = orders.filter((o) =>
    ['accepted', 'preparing', 'ready'].includes(o.status),
  );
  const outForDelivery = orders.filter((o) =>
    ['courier_assigned', 'picked_up'].includes(o.status),
  );

  return (
    <div className="px-5 lg:px-7 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-[24px] text-ink-soft leading-tight">Заказы</h1>
        {!audioEnabled && (
          <button
            onClick={enableAudio}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-fig-50 hover:bg-fig-100 text-fig-700 text-[12px] font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            Включить звук
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="inline-block w-5 h-5 border-2 border-fig-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyInbox />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Column title="Новые" count={newOrders.length} highlight>
            {newOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showStoreName={showStoreName}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
            {newOrders.length === 0 && <EmptyColumn message="Нет новых" />}
          </Column>
          <Column title="В работе" count={inProgress.length}>
            {inProgress.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showStoreName={showStoreName}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
            {inProgress.length === 0 && <EmptyColumn message="—" />}
          </Column>
          <Column title="В пути" count={outForDelivery.length}>
            {outForDelivery.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showStoreName={showStoreName}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
            {outForDelivery.length === 0 && <EmptyColumn message="—" />}
          </Column>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          allowManualAssign={allowManualAssign}
          onClose={() => setSelectedOrder(null)}
          onTransition={(status) => transition(selectedOrder.id, status)}
        />
      )}
    </div>
  );
}

function Column({
  title,
  count,
  highlight,
  children,
}: {
  title: string;
  count: number;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1 mb-1">
        <h2 className="text-[12px] font-medium text-ink-subtle tracking-[1.4px] uppercase">{title}</h2>
        <span
          className={`min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-medium tabular-nums ${
            highlight && count > 0
              ? 'bg-fig-600 text-white animate-pulse'
              : 'bg-black/[0.06] text-ink-muted'
          }`}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyColumn({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 rounded-xl border border-dashed border-black/[0.08] text-center text-[12px] text-ink-faint">
      {message}
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-fig-50 flex items-center justify-center mb-4 text-fig-600">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 13h8M8 17h5" />
        </svg>
      </div>
      <p className="text-[15px] font-medium text-ink-soft">Пока нет заказов</p>
      <p className="text-[12px] text-ink-muted mt-1">Новые заказы появятся здесь автоматически</p>
    </div>
  );
}

function OrderCard({
  order,
  showStoreName,
  onClick,
}: {
  order: InboxOrder;
  showStoreName?: boolean;
  onClick: () => void;
}) {
  const minutesAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const stale = order.status === 'placed' && minutesAgo > 5;
  const itemCount = order.items.reduce((acc, i) => acc + 1, 0);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border p-3.5 hover:shadow-card transition-all ${
        stale ? 'border-amber-300 bg-amber-50/30' : 'border-black/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-mono text-[11px] text-ink-subtle">{order.public_code}</div>
        <div className={`text-[11px] tabular-nums ${stale ? 'text-amber-700 font-medium' : 'text-ink-muted'}`}>
          {minutesAgo < 1 ? 'сейчас' : `${minutesAgo} мин`}
        </div>
      </div>
      <div className="text-[14px] font-medium text-ink-soft truncate">{order.customer_name}</div>
      <div className="text-[11px] text-ink-muted truncate">{order.customer_phone}</div>
      {showStoreName && order.store && (
        <div className="text-[10px] text-fig-700 mt-1">{order.store.name}</div>
      )}
      <div className="flex items-baseline justify-between mt-2.5 pt-2.5 border-t border-black/[0.04]">
        <div className="text-[11px] text-ink-muted">{itemCount} поз.</div>
        <div className="text-[14px] font-medium text-ink-soft tabular-nums">
          {Number(order.total).toFixed(0)} сом
        </div>
      </div>
    </button>
  );
}

function OrderDetailDrawer({
  order,
  allowManualAssign = false,
  onClose,
  onTransition,
}: {
  order: InboxOrder;
  allowManualAssign?: boolean;
  onClose: () => void;
  onTransition: (status: 'accepted' | 'ready' | 'cancelled') => void;
}) {
  const canAccept = order.status === 'placed';
  const canReady = order.status === 'accepted' || order.status === 'preparing';
  const canCancel = !['delivered', 'cancelled', 'picked_up'].includes(order.status);
  // Operator can manually assign once the order is past acceptance and has no courier
  const canAssign =
    allowManualAssign &&
    !order.courier_id &&
    ['accepted', 'preparing', 'ready', 'courier_assigned'].includes(order.status);

  return (
    <div className="fixed inset-0 z-50">
      <button onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade-in" aria-label="Close" />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <div>
            <div className="font-mono text-[12px] text-ink-subtle">{order.public_code}</div>
            <div className="text-[16px] font-medium text-ink-soft">{order.customer_name}</div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Section title="Контакт">
            <a href={`tel:${order.customer_phone}`} className="text-[14px] text-fig-700 font-medium">
              {order.customer_phone}
            </a>
          </Section>

          {order.address && (
            <Section title="Адрес доставки">
              <div className="text-[13px] text-ink-soft">{order.address.formatted_address}</div>
              {order.address.details && (
                <div className="text-[11px] text-ink-muted mt-0.5">{order.address.details}</div>
              )}
            </Section>
          )}

          <Section title="Состав заказа">
            <div className="space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between text-[13px]">
                  <div className="text-ink-soft">
                    {item.name_snapshot}
                    <span className="text-ink-muted ml-1">
                      × {item.quantity}
                      {(item.unit_snapshot === 'kg' || item.unit_snapshot === 'gram') && ' кг'}
                    </span>
                  </div>
                  <div className="text-ink-soft tabular-nums">
                    {Number(item.subtotal).toFixed(0)} сом
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2.5 border-t border-black/[0.04] space-y-1">
              <div className="flex items-baseline justify-between text-[12px] text-ink-muted">
                <span>Сумма</span>
                <span className="tabular-nums">{Number(order.subtotal).toFixed(0)} сом</span>
              </div>
              <div className="flex items-baseline justify-between text-[12px] text-ink-muted">
                <span>Доставка</span>
                <span className="tabular-nums">
                  {Number(order.delivery_fee) === 0 ? '—' : `${Number(order.delivery_fee).toFixed(0)} сом`}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[14px] font-medium text-ink-soft pt-1">
                <span>Итого</span>
                <span className="tabular-nums">{Number(order.total).toFixed(0)} сом</span>
              </div>
            </div>
          </Section>

          <Section title="Оплата">
            <div className="text-[13px] text-ink-soft">
              {order.payment_method === 'cash'
                ? 'Наличные'
                : order.payment_method === 'qr'
                ? 'QR'
                : 'Перевод'}
              {order.payment_status === 'paid' && (
                <span className="ml-2 text-[11px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                  Оплачено
                </span>
              )}
              {order.payment_status === 'pending' && order.payment_method !== 'cash' && (
                <span className="ml-2 text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                  Ждём оплату
                </span>
              )}
              {order.payment_status === 'awaiting_confirmation' && (
                <span className="ml-2 text-[11px] text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded">
                  Клиент оплатил — проверьте
                </span>
              )}
            </div>
            {order.payment_status === 'awaiting_confirmation' && (
              <PaymentConfirmRow orderId={order.id} onDone={onClose} />
            )}
          </Section>

          {order.notes && (
            <Section title="Комментарий">
              <div className="text-[13px] text-ink-soft">{order.notes}</div>
            </Section>
          )}

          {canAssign && <ManualAssignPanel orderId={order.id} onAssigned={onClose} />}
        </div>

        {/* Action bar */}
        <div className="px-5 py-4 border-t border-black/[0.06] safe-bottom space-y-2">
          {canAccept && (
            <button
              onClick={() => onTransition('accepted')}
              className="w-full py-3.5 rounded-xl bg-fig-600 hover:bg-fig-700 active:scale-[0.99] text-white font-medium text-[14px] transition-all"
            >
              Принять заказ
            </button>
          )}
          {canReady && (
            <button
              onClick={() => onTransition('ready')}
              className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white font-medium text-[14px] transition-all"
            >
              Готов к выдаче
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onTransition('cancelled')}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-[13px] transition-all"
            >
              Отменить
            </button>
          )}
          {!canAccept && !canReady && !canCancel && (
            <div className="text-center text-[12px] text-ink-muted">Статус: {order.status}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

interface CourierOption {
  userId: string;
  name: string;
  phone: string;
  status: 'offline' | 'online' | 'on_delivery';
  busy: boolean;
}

function ManualAssignPanel({ orderId, onAssigned }: { orderId: string; onAssigned: () => void }) {
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/dispatch/assign');
      const data = await res.json();
      if (res.ok) setCouriers(data.couriers ?? []);
      else setError('Не удалось загрузить курьеров');
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  async function assign(courierId: string) {
    setAssigning(courierId);
    setError(null);
    try {
      const res = await fetch('/api/staff/dispatch/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, courierId }),
      });
      const data = await res.json();
      if (res.ok) {
        onAssigned();
      } else {
        const map: Record<string, string> = {
          courier_busy: 'Курьер уже занят другим заказом',
          order_closed: 'Заказ уже закрыт',
        };
        setError(map[data.error] ?? 'Не удалось назначить');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setAssigning(null);
    }
  }

  if (!open) {
    return (
      <button
        onClick={load}
        className="w-full mt-1 py-3 rounded-xl border border-fig-600/30 text-fig-700 hover:bg-fig-50 text-[13px] font-medium transition-all flex items-center justify-center gap-2"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
        </svg>
        Назначить курьера вручную
      </button>
    );
  }

  return (
    <div className="mt-1 border border-fig-600/20 rounded-xl p-3 bg-fig-50/40">
      <div className="text-[11px] font-medium text-ink-subtle uppercase tracking-wider mb-2">
        Выберите курьера
      </div>
      {loading && <div className="text-[12px] text-ink-muted py-2">Загрузка...</div>}
      {error && <div className="text-[12px] text-red-600 py-1.5">{error}</div>}
      {!loading && couriers.length === 0 && (
        <div className="text-[12px] text-ink-muted py-2">Нет курьеров</div>
      )}
      <div className="space-y-1.5">
        {couriers.map((c) => (
          <div
            key={c.userId}
            className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-black/[0.05]"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink-soft truncate">{c.name}</div>
              <div className="text-[10px] text-ink-muted">
                {c.status === 'online' ? 'На смене' : c.status === 'on_delivery' ? 'На доставке' : 'Не на смене'}
                {c.busy ? ' · занят' : ''}
              </div>
            </div>
            <button
              onClick={() => assign(c.userId)}
              disabled={assigning !== null || c.busy}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-fig-600 text-white text-[12px] font-medium disabled:opacity-40"
            >
              {assigning === c.userId ? '...' : 'Назначить'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentConfirmRow({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'confirm' | 'reject') {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/orders/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, decision }),
      });
      if (res.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2 mt-2.5">
      <button
        onClick={() => decide('confirm')}
        disabled={busy}
        className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-[12.5px] font-medium disabled:opacity-60"
      >
        Оплата получена
      </button>
      <button
        onClick={() => decide('reject')}
        disabled={busy}
        className="px-3.5 py-2.5 rounded-lg border border-red-200 text-red-600 text-[12.5px] font-medium disabled:opacity-60"
      >
        Нет
      </button>
    </div>
  );
}
