'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatSom } from '@/lib/format';

interface CourierRow {
  courier_id: string;
  name: string;
  phone: string | null;
  outstanding: number;
  order_count: number;
  last_deposit_at: string | null;
}
interface DepositRow {
  id: string;
  courier_name: string;
  amount: number;
  order_count: number;
  status: string;
  reference: string | null;
  note: string | null;
  created_at: string;
}
interface Data {
  couriers: CourierRow[];
  total_outstanding: number;
  deposits: DepositRow[];
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CourierCashReconciliation() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<CourierRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/staff/admin/cash', { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
  }, [load]);

  return (
    <div className="px-5 lg:px-7 py-5 max-w-3xl">
      <h1 className="font-serif text-[24px] text-ink-soft leading-tight mb-1">Наличные курьеров</h1>
      <p className="text-[13px] text-ink-muted mb-5">
        Наличные с заказов курьер собирает от имени Colibri. Здесь видно, сколько каждый должен сдать, и можно отметить сверку. Это отдельный учёт — не влияет на выплаты магазинам.
      </p>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/60 rounded-2xl animate-pulse" />)}</div>
      ) : !data ? (
        <div className="text-[13px] text-ink-muted">Не удалось загрузить.</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-fig-600 to-fig-800 rounded-2xl p-4 text-white shadow-card inline-block min-w-[220px]">
            <div className="text-[11px] uppercase tracking-[1.2px] text-white/70">К сдаче в Colibri</div>
            <div className="font-serif text-[26px] tabular-nums mt-1">{formatSom(data.total_outstanding)} <span className="text-[13px] text-white/70">сом</span></div>
          </div>

          {/* Couriers with outstanding cash */}
          <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 bg-black/[0.02] text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
              <div>Курьер</div>
              <div className="text-right w-[100px]">К сдаче</div>
              <div className="w-[92px]" />
            </div>
            {data.couriers.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-ink-muted">Нет несданной наличности.</div>
            )}
            {data.couriers.map((c) => (
              <div key={c.courier_id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center border-t border-black/[0.04]">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-ink-soft truncate">{c.name}</div>
                  <div className="text-[11px] text-ink-muted">{c.order_count} заказ(ов) · последняя сверка {fmtDate(c.last_deposit_at)}</div>
                </div>
                <div className="text-right w-[100px]">
                  <div className="text-[15px] font-semibold text-fig-800 tabular-nums">{formatSom(c.outstanding)}</div>
                  <div className="text-[10px] text-ink-faint">сом</div>
                </div>
                <button
                  onClick={() => setActive(c)}
                  className="w-[92px] py-2 rounded-lg bg-fig-600 hover:bg-fig-700 text-white text-[12px] font-medium"
                >
                  Сверить
                </button>
              </div>
            ))}
          </div>

          {/* Deposit history */}
          <div>
            <h2 className="text-[12px] font-medium text-ink-subtle tracking-[1.4px] uppercase mb-2.5">История сверок</h2>
            {data.deposits.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/[0.05] p-5 text-center text-[13px] text-ink-muted shadow-soft">Сверок пока не было.</div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-soft overflow-hidden">
                {data.deposits.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-black/[0.04] first:border-t-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-ink-soft truncate">{d.courier_name}</div>
                      <div className="text-[11px] text-ink-muted">{fmtDate(d.created_at)} · {d.order_count} заказ(ов){d.reference ? ` · ${d.reference}` : ''}</div>
                    </div>
                    <div className="text-[15px] font-semibold text-fig-800 tabular-nums shrink-0">{formatSom(d.amount)} <span className="text-[10px] text-ink-muted font-normal">сом</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {active && (
        <ReconcileModal
          courier={active}
          onClose={() => setActive(null)}
          onDone={async () => { setActive(null); await load(); }}
        />
      )}
    </div>
  );
}

function ReconcileModal({ courier, onClose, onDone }: { courier: CourierRow; onClose: () => void; onDone: () => Promise<void> }) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/admin/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId: courier.courier_id, reference, note }),
      });
      const d = await res.json();
      if (res.ok && d.reconciled) {
        await onDone();
      } else if (res.ok && !d.reconciled) {
        setMessage('Нет несданных заказов.');
      } else {
        setMessage(d.detail || 'Не удалось записать сверку.');
      }
    } catch {
      setMessage('Ошибка сети.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade-in" aria-label="Закрыть" />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 animate-pop">
        <div className="text-[11px] text-ink-subtle uppercase tracking-wide">Сверка наличных</div>
        <div className="text-[16px] font-medium text-ink-soft">{courier.name}</div>
        <div className="mt-3 bg-gradient-to-br from-fig-600 to-fig-800 rounded-xl p-4 text-white">
          <div className="text-[11px] text-white/70 uppercase tracking-wide">Курьер сдаёт</div>
          <div className="font-serif text-[28px] tabular-nums mt-0.5">{formatSom(courier.outstanding)} <span className="text-[14px] text-white/70">сом</span></div>
          <div className="text-[11px] text-white/60">{courier.order_count} заказ(ов)</div>
        </div>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Референс / расписка (необязательно)"
          className="w-full mt-3 px-3 py-2 rounded-lg border border-black/[0.1] text-[13px] focus:outline-none focus:border-fig-600/40"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Примечание (необязательно)"
          className="w-full mt-2 px-3 py-2 rounded-lg border border-black/[0.1] text-[13px] focus:outline-none focus:border-fig-600/40"
        />
        {message && <div className="text-[12px] text-ink-muted text-center mt-2">{message}</div>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-black/[0.1] text-ink-muted text-[13px] font-medium">Отмена</button>
          <button
            onClick={submit}
            disabled={submitting || courier.outstanding <= 0}
            className="flex-[2] py-2.5 rounded-lg btn-fig text-white text-[13px] font-medium disabled:opacity-50"
          >
            {submitting ? 'Запись...' : `Записать сдачу ${formatSom(courier.outstanding)} сом`}
          </button>
        </div>
        <p className="text-[10px] text-ink-faint text-center mt-2.5">Отметит заказы как сданные. Деньги передаются отдельно.</p>
      </div>
    </div>
  );
}
