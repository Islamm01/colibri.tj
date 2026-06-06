import { NextResponse } from 'next/server';
import { readStaffSession } from '@/lib/staff/session';
import { acceptOffer } from '@/lib/dispatch/dispatcher';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'courier') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const result = await acceptOffer({ offerId: id, courierId: session.userId });
  if (!result.accepted) {
    return NextResponse.json({ error: 'already_taken' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, orderId: result.orderId });
}
