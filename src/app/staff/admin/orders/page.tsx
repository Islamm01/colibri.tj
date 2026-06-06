import { OrdersInbox } from '@/components/staff/OrdersInbox';

export const dynamic = 'force-dynamic';

export default function AdminOrdersPage() {
  return <OrdersInbox showStoreName allowManualAssign />;
}
