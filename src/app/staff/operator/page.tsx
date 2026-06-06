import { OrdersInbox } from '@/components/staff/OrdersInbox';

export const dynamic = 'force-dynamic';

export default function OperatorPage() {
  return <OrdersInbox showStoreName allowManualAssign />;
}
