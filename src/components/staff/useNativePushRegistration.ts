'use client';

import { useEffect } from 'react';

// When the site runs inside the Colibri native shell (a WebView), this hook
// performs the token handshake:
//
//   1. The page (this hook) signals readiness by posting REQUEST_PUSH_TOKEN
//      to the native shell. It only runs inside StaffShell, i.e. after a
//      staff user is authenticated — so the cookie is present.
//   2. The native shell obtains the Expo push token (asking OS permission if
//      needed) and injects it back by calling window.__colibriReceivePushToken.
//   3. We POST the token to /api/app/push-token, which is same-origin so the
//      colibri_staff cookie authenticates it and the token is saved to *this*
//      logged-in user.
//
// On a normal web browser (no ReactNativeWebView) the hook is a no-op.

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __colibriReceivePushToken?: (token: string) => void;
  }
}

async function registerToken(token: string) {
  try {
    await fetch('/api/app/push-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort: the native shell will retry on next launch.
  }
}

export function useNativePushRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ReactNativeWebView) return;

    // Native calls this once it has a token.
    window.__colibriReceivePushToken = (token: string) => {
      if (typeof token === 'string' && token.length > 0) {
        void registerToken(token);
      }
    };

    // Tell the shell we're ready to receive a token.
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_PUSH_TOKEN' }));
    } catch {
      // ignore
    }

    return () => {
      delete window.__colibriReceivePushToken;
    };
  }, []);
}
