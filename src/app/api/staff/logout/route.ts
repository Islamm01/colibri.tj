import { NextResponse } from 'next/server';
import { clearStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  await clearStaffSession();
  return NextResponse.json({ ok: true });
}
