-- =====================================================================
-- Colibri — Configurable platform commission on courier delivery
--
-- The platform keeps a percentage of each delivery fee; the courier gets the
-- rest. e.g. delivery_fee = 20 сом, courier_commission_rate = 0.20 →
-- platform keeps 4 сом, courier earns 16 сом.
--
-- The courier's share is SNAPSHOTTED onto each order at creation time
-- (orders.courier_earning) so that changing the rate later never rewrites a
-- courier's past earnings or historical analytics.
-- =====================================================================

alter table platform_settings
  add column if not exists courier_commission_rate numeric(4,3) not null default 0.20;

alter table orders
  add column if not exists courier_earning numeric(10,2);

-- Backfill existing orders with the default 20% platform cut so history and
-- analytics are consistent with the new model.
update orders
  set courier_earning = round(coalesce(delivery_fee, 0) * (1 - 0.20), 2)
  where courier_earning is null;
