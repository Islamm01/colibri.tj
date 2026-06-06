'use client';

import { useEffect, useState } from 'react';

interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: 'courier' | 'operator' | 'store_owner' | 'admin';
  status: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  courier: 'Курьер',
  operator: 'Оператор',
  store_owner: 'Магазин',
  admin: 'Админ',
};

const ROLE_TABS = ['courier', 'operator', 'store_owner'] as const;

export function StaffManager() {
  const [tab, setTab] = useState<'courier' | 'operator' | 'store_owner'>('courier');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/admin/users?role=${tab}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="px-5 lg:px-7 py-5 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-[24px] text-ink-soft leading-tight">Сотрудники</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3.5 py-2 rounded-lg btn-fig text-white text-[12.5px] font-medium"
        >
          + Добавить
        </button>
      </div>
      <p className="text-[13px] text-ink-muted mb-4">Создавайте аккаунты курьеров и операторов.</p>

      <div className="flex gap-1.5 mb-5">
        {ROLE_TABS.map((r) => (
          <button
            key={r}
            onClick={() => setTab(r)}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-all ${
              tab === r ? 'bg-fig-600 border-fig-600 text-white' : 'bg-white border-black/[0.08] text-ink-muted'
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/60 rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-ink-muted text-[14px]">Нет сотрудников</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl border border-black/[0.06] p-3.5 shadow-soft flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink-soft">{u.name}</div>
                <div className="text-[12px] text-ink-muted">{u.phone}</div>
              </div>
              <div className="flex items-center gap-2">
                {u.role === 'courier' && u.status && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    u.status === 'online' ? 'bg-green-50 text-green-700'
                    : u.status === 'on_delivery' ? 'bg-blue-50 text-blue-700'
                    : 'bg-cream-100 text-ink-muted'
                  }`}>
                    {u.status === 'online' ? 'На смене' : u.status === 'on_delivery' ? 'Доставляет' : 'Не в сети'}
                  </span>
                )}
                <ResetPasswordButton userId={u.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateStaffModal role={tab} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function ResetPasswordButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    const pw = prompt('Новый пароль (минимум 6 символов):');
    if (!pw || pw.length < 6) return;
    setBusy(true);
    try {
      const res = await fetch('/api/staff/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: pw }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={reset} disabled={busy} className="text-[11px] text-ink-muted hover:text-fig-700 px-2 py-1">
      {done ? '✓' : busy ? '...' : 'Пароль'}
    </button>
  );
}

function CreateStaffModal({ role, onClose, onCreated }: { role: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+992');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ERR: Record<string, string> = {
    invalid_name: 'Введите имя',
    invalid_phone: 'Неверный номер',
    weak_password: 'Пароль минимум 6 символов',
    phone_taken: 'Этот номер уже используется',
  };

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/staff/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, role }),
      });
      const data = await res.json();
      if (res.ok) onCreated();
      else setError(ERR[data.error] ?? 'Ошибка');
    } catch {
      setError('Ошибка сети');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-[19px] text-ink-soft mb-4">Новый {ROLE_LABEL[role]?.toLowerCase()}</h2>
        <div className="space-y-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:border-fig-600/40" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+992 90 000 00 00" inputMode="tel" className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:border-fig-600/40" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль (мин. 6)" className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.1] text-[14px] focus:outline-none focus:border-fig-600/40" />
        </div>
        {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-black/[0.12] text-ink-soft text-[13px] font-medium">Отмена</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-lg btn-fig text-white text-[13px] font-medium disabled:opacity-60">{busy ? '...' : 'Создать'}</button>
        </div>
      </div>
    </div>
  );
}
