import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { isExpoPushToken } from '@/lib/push/expo';

export const dynamic = 'force-dynamic';

// POST — register the Expo push token for the currently logged-in staff user.
//
// Auth is the existing `colibri_staff` cookie: the native app loads the real
// site in a WebView, the user logs in there as normal, and this request is
// same-origin so the cookie rides along automatically. No separate app login
// or bearer token is needed.
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = body?.token;

  if (!isExpoPushToken(token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update({ expo_push_token: token })
    .eq('id', session.userId);

  if (error) {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
