import { requireStaff } from '@/lib/staff/session';
import { OrdersInbox } from '@/components/staff/OrdersInbox';

export const dynamic = 'force-dynamic';

export default async function StoreOrdersPage() {
  const session = await requireStaff(['store_owner']);
  return <OrdersInbox storeId={session.storeId ?? null} />;
}
