import { requireStaff } from '@/lib/staff/session';
import { StaffShell } from '@/components/staff/StaffShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff(['admin']);

  return (
    <StaffShell
      session={{ name: session.name, role: session.role }}
      navItems={[
        { href: '/staff/admin/analytics', label: 'Аналитика', icon: 'prices' },
        { href: '/staff/admin/orders', label: 'Заказы', icon: 'orders' },
        { href: '/staff/admin/stores', label: 'Магазины', icon: 'stores' },
        { href: '/staff/admin', label: 'Заявки', icon: 'partners' },
        { href: '/staff/admin/couriers', label: 'Курьеры', icon: 'users' },
        { href: '/staff/admin/staff', label: 'Сотрудники', icon: 'users' },
        { href: '/staff/admin/prices', label: 'Цены', icon: 'prices' },
        { href: '/staff/admin/payments', label: 'Оплата', icon: 'payments' },
        { href: '/staff/admin/settings', label: 'Настройки', icon: 'settings' },
      ]}
    >
      {children}
    </StaffShell>
  );
}
