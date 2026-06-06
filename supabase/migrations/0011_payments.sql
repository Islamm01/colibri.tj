-- =====================================================================
-- ANJIR — Slice 11: Payments
--
-- Adds the platform's payment configuration (the QR image / card number /
-- bank details customers pay to) plus richer payment tracking on orders.
--
-- Launch model for Tajikistan:
--   cash          -> pay courier on delivery (no online step)
--   qr            -> customer scans ANJIR's QR (Alif/DC/Korti Milli), then
--                    taps "I paid"; operator confirms receipt
--   bank_transfer -> customer transfers to the shown card/account, taps
--                    "I paid"; operator confirms receipt
--
-- This is "manual confirm now, automatic later": when you obtain a real
-- payment-provider API + webhook, the webhook calls the same confirm path
-- and flips payment_status to 'paid' automatically.
-- =====================================================================

-- Single-row platform payment configuration (id always = 1)
create table if not exists payment_settings (
  id int primary key default 1 check (id = 1),
  -- QR
  qr_enabled boolean not null default true,
  qr_image_url text,                 -- uploaded QR (Alif/DC) image in storage
  qr_label text default 'Отсканируйте QR в приложении банка',
  -- Bank transfer / card
  transfer_enabled boolean not null default true,
  card_number text,                  -- e.g. Korti Milli / Alif card number
  card_holder text,                  -- name on card
  bank_name text,                    -- e.g. "Алиф Банк"
  transfer_note text,                -- extra instruction shown to customer
  -- Cash
  cash_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into payment_settings (id) values (1) on conflict (id) do nothing;

-- Payment confirmation trail on orders
alter table orders
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references users(id),
  add column if not exists payment_reference text,   -- customer-entered txn ref (optional)
  add column if not exists payment_claimed_at timestamptz; -- when customer tapped "I paid"

-- 'awaiting_confirmation' bridges the gap between customer claim and staff verify
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_status' and e.enumlabel = 'awaiting_confirmation'
  ) then
    alter type payment_status add value 'awaiting_confirmation' before 'paid';
  end if;
end $$;
