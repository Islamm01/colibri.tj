-- =====================================================================
-- Colibri — Slice 16 / native push (idempotent, safe to run anytime)
--
-- The native app (Expo) registers each device's Expo push token so the
-- backend can fire a real native notification when an order is assigned
-- to a courier, even when the app is closed.
--
-- Slice 1 stores a single token per user (one device). A dedicated
-- device_tokens table (many devices per user, last-seen, platform) is the
-- natural slice-2 upgrade — not needed to prove one push to one courier.
-- =====================================================================

alter table users
  add column if not exists expo_push_token text;

-- Partial index: we only ever look up users who actually have a token,
-- which is a small subset (staff with the app installed).
create index if not exists idx_users_expo_push_token
  on users(expo_push_token)
  where expo_push_token is not null;
