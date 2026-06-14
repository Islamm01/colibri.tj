import { OrdersInbox } from '@/components/staff/OrdersInbox';

export const dynamic = 'force-dynamic';

export default function OperatorGiftsPage() {
  return <OrdersInbox showStoreName allowManualAssign vertical="gifts" title="Подарочные заказы" />;
}
