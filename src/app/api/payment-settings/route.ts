import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export interface PaymentSettings {
  qr_enabled: boolean;
  qr_image_url: string | null;
  qr_label: string | null;
  transfer_enabled: boolean;
  card_number: string | null;
  card_holder: string | null;
  bank_name: string | null;
  transfer_note: string | null;
  cash_enabled: boolean;
}

const DEFAULTS: PaymentSettings = {
  qr_enabled: true,
  qr_image_url: null,
  qr_label: null,
  transfer_enabled: true,
  card_number: null,
  card_holder: null,
  bank_name: null,
  transfer_note: null,
  cash_enabled: true,
};

// GET — public; checkout uses this to know which methods are on and show details
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ settings: DEFAULTS });
  }
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle();
    return NextResponse.json({ settings: data ?? DEFAULTS });
  } catch {
    return NextResponse.json({ settings: DEFAULTS });
  }
}

// PATCH — admin only; update the platform payment configuration
export async function PATCH(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const allowed: (keyof PaymentSettings)[] = [
    'qr_enabled', 'qr_image_url', 'qr_label',
    'transfer_enabled', 'card_number', 'card_holder', 'bank_name', 'transfer_note',
    'cash_enabled',
  ];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('payment_settings').upsert({ id: 1, ...update });
  if (error) {
    return NextResponse.json({ error: 'save_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
