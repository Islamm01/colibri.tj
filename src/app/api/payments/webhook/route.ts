import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { markOrderPaid } from '@/lib/orders/payment';

export const dynamic = 'force-dynamic';

/**
 * Payment provider webhook (Alif Mobi / Korti Milli / Dushanbe City, etc.)
 *
 * THIS IS A SCAFFOLD. It is structured to be the single automated entry point
 * that marks an order paid once you have a real merchant account. To go live:
 *
 *  1. Set PAYMENT_WEBHOOK_SECRET in your env (shared secret or signature key
 *     the provider gives you).
 *  2. Map the provider's payload to { order_code, status, amount, signature }
 *     in parseProviderPayload() below — each provider differs.
 *  3. Verify the signature in verifySignature() per the provider's docs.
 *
 * Until then it rejects unauthenticated calls, so it's safe to deploy.
 */

function verifySignature(_rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return false; // not configured yet -> reject everything
  // TODO: implement the provider's exact signature scheme (HMAC etc.)
  return signature === secret;
}

interface NormalizedEvent {
  orderCode: string;
  paid: boolean;
  reference?: string;
}

function parseProviderPayload(body: Record<string, unknown>): NormalizedEvent | null {
  // TODO: adapt to the real provider. Example generic shape:
  const orderCode = (body.order_code ?? body.orderId ?? body.label) as string | undefined;
  const statusRaw = (body.status ?? body.state) as string | undefined;
  if (!orderCode || !statusRaw) return null;
  return {
    orderCode: orderCode.toUpperCase(),
    paid: ['paid', 'success', 'completed', 'ok'].includes(statusRaw.toLowerCase()),
    reference: (body.transaction_id ?? body.txn ?? undefined) as string | undefined,
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-signature') ?? request.headers.get('authorization');

  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const event = parseProviderPayload(body);
  if (!event) return NextResponse.json({ error: 'unrecognized_payload' }, { status: 400 });
  if (!event.paid) return NextResponse.json({ ok: true, ignored: 'not_a_paid_event' });

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('id, payment_status')
    .eq('public_code', event.orderCode)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true, already_paid: true });

  // Same release path as a manual staff confirmation: mark paid and, for an
  // online order still awaiting payment, move it to `placed` + notify the store.
  await markOrderPaid({
    orderId: order.id,
    extraOrderFields: { payment_reference: event.reference ?? null },
    event: {
      type: 'payment.confirmed_by_provider',
      actorRole: 'system',
      payload: { reference: event.reference ?? null },
    },
  });

  return NextResponse.json({ ok: true });
}
