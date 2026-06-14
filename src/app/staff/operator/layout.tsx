import { requireStaff } from '@/lib/staff/session';
import { StaffShell } from '@/components/staff/StaffShell';

export const dynamic = 'force-dynamic';

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff(['operator', 'admin']);

  return (
    <StaffShell
      session={{ name: session.name, role: session.role }}
      navItems={[
        { href: '/staff/operator', label: 'Все заказы', icon: 'orders' },
        { href: '/staff/operator/gifts', label: 'Подарки', icon: 'gifts' },
        { href: '/staff/operator/dispatch', label: 'Диспетчер', icon: 'users' },
        { href: '/staff/operator/prices', label: 'Цены', icon: 'prices' },
      ]}
    >
      {children}
    </StaffShell>
  );
}
