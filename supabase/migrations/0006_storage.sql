-- =====================================================================
-- ANJIR — Slice 4c: Supabase Storage for product/store images
--
-- Creates two public buckets with strict RLS on writes:
--   - product-images:  products/{store_id}/{product_id}/{size}.webp
--   - store-assets:    stores/{store_id}/(logo|cover).webp
--
-- Read: public (anyone with the URL can fetch)
-- Write: only via service role from our /api routes (we authorize there)
-- =====================================================================

-- Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('store-assets', 'store-assets', true, 4194304, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop any prior policies on these buckets
drop policy if exists "Public read product-images" on storage.objects;
drop policy if exists "Public read store-assets" on storage.objects;
drop policy if exists "Service write product-images" on storage.objects;
drop policy if exists "Service write store-assets" on storage.objects;
drop policy if exists "Service delete product-images" on storage.objects;
drop policy if exists "Service delete store-assets" on storage.objects;

-- Public reads
create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Public read store-assets"
  on storage.objects for select
  using (bucket_id = 'store-assets');

-- Writes via service role only (our /api/staff/upload/* endpoints authorize first)
create policy "Service write product-images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

create policy "Service write store-assets"
  on storage.objects for insert
  with check (bucket_id = 'store-assets');

create policy "Service update product-images"
  on storage.objects for update
  using (bucket_id = 'product-images');

create policy "Service update store-assets"
  on storage.objects for update
  using (bucket_id = 'store-assets');

create policy "Service delete product-images"
  on storage.objects for delete
  using (bucket_id = 'product-images');

create policy "Service delete store-assets"
  on storage.objects for delete
  using (bucket_id = 'store-assets');

-- =====================================================================
-- Strip all Unsplash URLs from seed data so the fallback placeholder
-- kicks in until the store owner uploads real photos.
-- =====================================================================

update stores
set cover_image_url = null
where cover_image_url is not null
  and cover_image_url like '%unsplash.com%';

update products
set images = '[]'::jsonb
where images::text like '%unsplash.com%';
