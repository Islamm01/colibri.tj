import { OrdersInbox } from '@/components/staff/OrdersInbox';
import { GiftRequestsQueue } from '@/components/staff/GiftRequestsQueue';

export const dynamic = 'force-dynamic';

export default function OperatorGiftsPage() {
  return (
    <div>
      <OrdersInbox showStoreName allowManualAssign vertical="gifts" title="Подарочные заказы" />
      <div className="border-t border-black/[0.06]" />
      <GiftRequestsQueue />
    </div>
  );
}
