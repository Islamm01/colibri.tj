import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendExpoPush, type ExpoPushMessage } from '@/lib/push/expo';

/**
 * Push a notification to one or more users by id. Looks up each user's stored
 * Expo push token and sends to those that have one. Best-effort and never
 * throws — callers fire this without it being able to break their operation.
 *
 * Returns the number of devices the push was accepted for (0 if nobody has a
 * token yet, which is the normal state until the app is installed).
 */
export async function notifyUsers(
  userIds: Array<string | null | undefined>,
  message: ExpoPushMessage,
): Promise<number> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return 0;

  try {
    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from('users')
      .select('expo_push_token')
      .in('id', ids)
      .not('expo_push_token', 'is', null);

    const tokens = (rows ?? []).map((r) => r.expo_push_token as string);
    return await sendExpoPush(tokens, message);
  } catch (err) {
    console.error('[notify] failed', err);
    return 0;
  }
}
