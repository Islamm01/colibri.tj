import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizePhone, isValidName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface Payload {
  business_name?: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  vertical?: string;
  category?: string;
  description?: string;
}

// Partner onboarding is for our single direction: Fruits & Dried Fruits
// (fresh fruit, nuts, dried fruit). No pharmacy/flowers/other.
const VERTICALS = ['fruits'];

export async function POST(request: Request) {
  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Validation
  const business = (payload.business_name ?? '').trim();
  if (business.length < 2) {
    return NextResponse.json({ error: 'invalid_business_name' }, { status: 400 });
  }
  if (!isValidName(payload.contact_name ?? '')) {
    return NextResponse.json({ error: 'invalid_contact_name' }, { status: 400 });
  }
  const phone = normalizePhone(payload.phone ?? '');
  if (!phone) {
    return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  }
  const vertical = VERTICALS.includes(payload.vertical ?? '') ? payload.vertical : 'other';

  const supabase = getSupabaseAdmin();
  const { error: insErr } = await supabase.from('partner_applications').insert({
    business_name: business,
    contact_name: payload.contact_name!.trim(),
    phone,
    address: payload.address?.trim() || null,
    vertical,
    category: payload.category?.trim() || null,
    description: payload.description?.trim() || null,
  });

  if (insErr) {
    return NextResponse.json({ error: 'save_failed', detail: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
