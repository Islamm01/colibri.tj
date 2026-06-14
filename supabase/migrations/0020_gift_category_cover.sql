-- =====================================================================
-- Colibri — explicit category cover image
--
-- Lets an operator pin ONE product per category as that category's cover.
-- The storefront uses the pinned cover everywhere the category is shown
-- (category card, category banner, homepage gift image) and falls back to
-- the first product image when nothing is pinned.
--
-- Idempotent; safe to re-run.
-- =====================================================================

alter table products
  add column if not exists is_category_cover boolean not null default false;

-- Enforce at most one cover per (store, category) at the database level.
-- Non-cover rows are excluded by the partial predicate, so this never
-- constrains ordinary products.
create unique index if not exists uq_products_category_cover
  on products(store_id, category)
  where is_category_cover = true;
