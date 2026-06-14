import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizePhone, isValidName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface Payload {
  contact_name?: string;
  phone?: string;
  budget?: number | null;
  occasion?: string;
  preferences?: string;
}

const OCCASIONS = ['holiday', 'corporate', 'custom', 'other'];

// Public — a customer requesting a custom gift set (Phase 1, operator-fulfilled).
export async function POST(request: Request) {
  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!isValidName(payload.contact_name ?? '')) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  const phone = normalizePhone(payload.phone ?? '');
  if (!phone) {
    return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  }

  const occasion = OCCASIONS.includes(payload.occasion ?? '') ? payload.occasion : 'other';
  const budget =
    typeof payload.budget === 'number' && Number.isFinite(payload.budget) && payload.budget >= 0
      ? payload.budget
      : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('gift_requests').insert({
    contact_name: payload.contact_name!.trim(),
    phone,
    budget,
    occasion,
    preferences: payload.preferences?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: 'save_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
