# Slice 16 — native push (web-side changes)

Goal of this slice: a real native notification reaches a courier's phone when an
operator assigns them an order, even with the app closed. This is the web/backend
half. The native half is the separate `colibri-app` project.

## Which files changed

**New**
- `supabase/migrations/0016_app_push.sql` — adds `users.expo_push_token` (+ partial index). Idempotent, safe to run anytime.
- `src/lib/push/expo.ts` — best-effort Expo push sender + `isExpoPushToken` validator. No secret needed to send.
- `src/app/api/app/push-token/route.ts` — `POST`; saves the caller's Expo token. Authenticated by the existing `colibri_staff` cookie (the WebView sends it automatically), so no separate app login.
- `src/components/staff/useNativePushRegistration.ts` — client hook; inside the native shell it asks for the token and POSTs it. No-op in a normal browser.

- `src/lib/push/notify.ts` — `notifyUsers(userIds, message)`: looks up users' tokens and sends. Best-effort.

**Edited**
- `src/lib/dispatch/dispatcher.ts` — **the real courier trigger.** In `dispatchNextOffer`, after offers are created, pushes every offered courier (broadcast fan-out) or the single chosen courier (sequential). This is what fires on actual orders, called when a store marks an order ready, on parcel creation, and on courier-offline re-dispatch.
- `src/app/api/orders/route.ts` — pushes the store owner when a new, immediately-actionable order (cash → `placed`) is created.
- `src/app/api/staff/dispatch/assign/route.ts` — operator-override path: pushes the courier on manual assign. (Also selects `public_code` for the body.)
- `src/components/staff/StaffShell.tsx` — calls `useNativePushRegistration()` (2 lines: import + call).

## Trigger map (who gets buzzed, when)

- **Courier** ← new offer created in `dispatchNextOffer` (the normal flow) AND manual operator assign.
- **Store owner** ← new cash order placed. (Online-payment orders should buzz the store at payment-confirm time — not wired yet, see below.)

## To go live

1. Run migration `0016` against the Supabase database (Tajik + fresh both fine — it's guarded).
2. Deploy to Vercel (these are server changes; they only take effect once deployed).
3. No new env vars. Expo's send API needs no secret for slice 1.

## Verify (quick, before the app even exists)

You can prove the endpoint independently: log into the web staff dashboard,
then in the browser console set `window.ReactNativeWebView = { postMessage(){} }`
and call `window.__colibriReceivePushToken('ExponentPushToken[test]')` — the
POST will 200 and the row will have the token. (A fake token won't deliver, but
it proves the wiring.)

## One thing to decide (product, not code)

Offers expire in **15 seconds** (`OFFER_TIMEOUT_SECONDS` in the dispatcher). Push
delivery can take a few seconds, so a courier may get the buzz with only ~10s
left to open and accept. Now that push exists, consider lengthening that window
(e.g. 30–45s) so the notification is actually actionable. I left it unchanged —
it's your call and a one-line change.

## Deliberately NOT in this slice

Accept/reject directly from the notification, store push on online-payment
confirm, customer push, and a multi-device token table. All later — after one
real push works end to end on a phone.
