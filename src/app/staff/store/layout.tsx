import { requireStaff } from '@/lib/staff/session';
import { StaffShell } from '@/components/staff/StaffShell';

export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff(['store_owner']);

  return (
    <StaffShell
      session={{ name: session.name, role: session.role }}
      navItems={[
        { href: '/staff/store/orders', label: 'Заказы', icon: 'orders' },
        { href: '/staff/store/products', label: 'Товары', icon: 'products' },
        { href: '/staff/store/hours', label: 'Часы', icon: 'hours' },
        { href: '/staff/store/settings', label: 'Настройки', icon: 'settings' },
      ]}
    >
      {children}
    </StaffShell>
  );
}
