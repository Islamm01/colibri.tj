import { redirect } from 'next/navigation';
import { readStaffSession, roleHomePath } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export default async function StaffIndexPage() {
  const session = await readStaffSession();
  if (!session) redirect('/staff/login');
  redirect(roleHomePath(session.role));
}
