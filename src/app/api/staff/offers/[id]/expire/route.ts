import { NextResponse } from 'next/server';
import { readStaffSession } from '@/lib/staff/session';
import { rejectOffer } from '@/lib/dispatch/dispatcher';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'courier') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await rejectOffer({ offerId: id, courierId: session.userId, reason: 'expired' });
  return NextResponse.json({ ok: true });
}
