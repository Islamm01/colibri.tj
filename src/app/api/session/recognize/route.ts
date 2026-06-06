import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body?.phone ?? '');
    if (!phone) {
      return NextResponse.json({ recognized: false }, { status: 200 });
    }

    const supabase = getSupabaseAdmin();

    // Find user by phone
    const { data: user } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('phone', phone)
      .eq('role', 'customer')
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ recognized: false, phone });
    }

    // Get the most recent address
    const { data: addresses } = await supabase
      .from('addresses')
      .select('id, label, formatted_address, details, lat, lng')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      recognized: true,
      user: { id: user.id, name: user.name, phone: user.phone },
      addresses: addresses ?? [],
    });
  } catch (err) {
    console.error('recognize error', err);
    return NextResponse.json({ recognized: false }, { status: 200 });
  }
}
