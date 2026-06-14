-- =====================================================================
-- Colibri — Gifts simplification (launch structure)
--
-- The Gifts pillar launched simpler than first scaffolded in 0018:
--   • three categories only (fruit_basket | honey | gift_box)
--   • one combined catalog (no occasion-based navigation)
--   • no custom-set request queue (no self-serve builder)
--
-- This migration removes the now-unused schema from 0018. Idempotent and
-- guarded, so it is safe whether or not 0018 created these objects.
-- Kept: the 'gifts' enum value, products.gift_contents, and the order
-- gift fields (gift_message, recipient_name, scheduled_date).
-- =====================================================================

-- Occasion tagging on products is no longer used — the category column
-- carries the gift type, and there is no occasion axis at launch.
alter table products drop column if exists occasion;

-- The custom gift-set request queue was removed (no self-serve builder).
-- Dropping the table also drops idx_gift_requests_status.
drop table if exists gift_requests;
