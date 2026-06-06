-- =====================================================================
-- ANJIR — Slice 13: Courier applications + store reviews
-- =====================================================================

-- Courier self-applications — people apply to become couriers; admin reviews
-- and, on approval, a courier login is issued (like partner onboarding).
create table if not exists courier_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  vehicle text not null default 'moto',   -- moto | bike | car | foot
  has_smartphone boolean not null default true,
  district text,                          -- where they can work
  about text,                             -- free text: experience, availability
  accepted_terms boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  decided_at timestamptz
);

create index if not exists idx_courier_applications_status
  on courier_applications(status, created_at desc);

-- Store reviews — a customer rates + comments on a store, ideally tied to a
-- delivered order. New stores naturally have zero rows (zero rating).
create table if not exists store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  customer_user_id uuid references users(id) on delete set null,
  customer_name text,
  rating int not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_reviews_store
  on store_reviews(store_id, created_at desc)
  where is_published = true;

-- One review per order (a customer can't spam reviews for the same order)
create unique index if not exists uq_store_reviews_order
  on store_reviews(order_id)
  where order_id is not null;

-- =====================================================================
-- Keep stores.rating / rating_count in sync via trigger
-- (stores table already has rating + rating_count columns from 0001)
-- =====================================================================
create or replace function recompute_store_rating() returns trigger as $$
declare
  target_store uuid;
begin
  target_store := coalesce(new.store_id, old.store_id);
  update stores s set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from store_reviews r
      where r.store_id = target_store and r.is_published
    ), 0),
    rating_count = (
      select count(*) from store_reviews r
      where r.store_id = target_store and r.is_published
    )
  where s.id = target_store;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_store_reviews_recompute on store_reviews;
create trigger trg_store_reviews_recompute
  after insert or update or delete on store_reviews
  for each row execute function recompute_store_rating();
