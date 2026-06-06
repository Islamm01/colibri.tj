import { requireStaff } from '@/lib/staff/session';
import { CourierApp } from '@/components/courier/CourierApp';

export const dynamic = 'force-dynamic';

export default async function CourierPage() {
  const session = await requireStaff(['courier']);
  return <CourierApp courierUserId={session.userId} />;
}
