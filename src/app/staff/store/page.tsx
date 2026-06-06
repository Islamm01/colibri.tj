import { redirect } from 'next/navigation';

export default function StoreIndex() {
  redirect('/staff/store/orders');
}
