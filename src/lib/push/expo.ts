// Expo push helper.
//
// Sends native push notifications via Expo's public push API. No secret or
// access token is required to *send* (Expo authenticates the recipient by the
// ExpoPushToken itself), which keeps slice 1 dependency-free. For higher
// volume we'd switch to the expo-server-sdk batching client later.
//
// All sends are best-effort: a failed push must never break the operation
// that triggered it (assigning a courier still succeeds even if the buzz
// fails). Callers should not await this in a way that blocks the response,
// or should swallow its result.

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  title: string;
  body: string;
  /** Arbitrary payload delivered to the app (e.g. { orderId, code }). */
  data?: Record<string, unknown>;
  /** Android channel; must match a channel registered in the app. */
  channelId?: string;
}

/** An Expo token looks like `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`. */
export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[')) &&
    value.endsWith(']')
  );
}

/**
 * Send a push to one or more Expo tokens. Returns the number of messages
 * accepted by Expo (not delivered — delivery is asynchronous). Never throws.
 */
export async function sendExpoPush(
  tokens: Array<string | null | undefined>,
  message: ExpoPushMessage,
): Promise<number> {
  const valid = tokens.filter(isExpoPushToken);
  if (valid.length === 0) return 0;

  const messages = valid.map((to) => ({
    to,
    sound: 'default',
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    priority: 'high',
    channelId: message.channelId ?? 'orders',
  }));

  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.error('[expo-push] non-OK response', res.status, await res.text().catch(() => ''));
      return 0;
    }
    return valid.length;
  } catch (err) {
    console.error('[expo-push] send failed', err);
    return 0;
  }
}
