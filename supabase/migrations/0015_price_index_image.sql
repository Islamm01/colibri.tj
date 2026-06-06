-- =====================================================================
-- Colibri — Price Index photos
--
-- Adds an optional product photo to each daily price item. Admins upload
-- a small square image; customers see a compact thumbnail next to the
-- name (falling back to the emoji when no photo is set).
--
-- Images live in the existing public `product-images` bucket under
-- `price-index/{item_key}/...` so no new bucket/policies are required.
-- =====================================================================

alter table price_index
  add column if not exists image_url text;
