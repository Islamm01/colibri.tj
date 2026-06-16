-- =====================================================================
-- Colibri — drop the per-product category cover
--
-- Category visuals are now curated, permanent brand assets shipped with
-- the app (see /public/categories/*). They no longer derive from store or
-- product content, so the operator-pinned cover flag added in 0020 is
-- removed. Idempotent and guarded.
-- =====================================================================

drop index if exists uq_products_category_cover;

alter table products drop column if exists is_category_cover;
