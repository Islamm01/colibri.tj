-- =====================================================================
-- ANJIR — Slice 8: Price Index
--
-- A daily record of what produce costs in Khujand — the "honest price"
-- that makes ANJIR the trusted source. Two price points per item:
--   farm_low / farm_high  = farm-gate range (what the farmer gets)
--   bazaar_low / bazaar_high = retail bazaar range (what shoppers pay)
--
-- The spread between them is the inefficiency ANJIR eventually captures.
-- Updated daily (manually by operator at first, automated later).
-- =====================================================================

create table if not exists price_index (
  id uuid primary key default gen_random_uuid(),
  -- Product identity
  item_key text not null,              -- stable slug e.g. 'apricot', 'fig', 'walnut'
  name_tj text not null,
  name_ru text not null,
  unit text not null default 'kg',     -- kg, piece, etc.
  category text not null default 'fruit', -- fruit | dried | nut | vegetable
  emoji text,                          -- quick visual marker

  -- Prices (TJS)
  farm_low numeric(10,2),
  farm_high numeric(10,2),
  bazaar_low numeric(10,2),
  bazaar_high numeric(10,2),

  -- Trend vs previous reading: 'up' | 'down' | 'flat'
  trend text default 'flat' check (trend in ('up', 'down', 'flat')),

  -- Optional: tie to a real orchard / region for the "story"
  region text,

  effective_date date not null default current_date,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per item per day
create unique index if not exists uq_price_index_item_date
  on price_index(item_key, effective_date);

create index if not exists idx_price_index_published
  on price_index(is_published, effective_date desc, sort_order);

-- Seed today's prices so the page isn't empty on first load.
-- These are realistic Khujand spring prices (TJS/kg) — operator edits daily.
insert into price_index (item_key, name_tj, name_ru, unit, category, emoji, farm_low, farm_high, bazaar_low, bazaar_high, trend, region, sort_order)
values
  ('apricot',   'Зардолу',        'Абрикос',        'kg', 'fruit',     '🍑', 8,  12, 16, 22, 'down', 'Бобоҷон Ғафуров', 1),
  ('fig',       'Анҷир',          'Инжир',          'kg', 'fruit',     '🟣', 18, 24, 30, 40, 'flat', 'Хуҷанд',          2),
  ('cherry',    'Гелос',          'Черешня',        'kg', 'fruit',     '🍒', 14, 20, 26, 34, 'up',   'Конибодом',       3),
  ('apple',     'Себ',            'Яблоко',         'kg', 'fruit',     '🍎', 5,  8,  10, 15, 'flat', 'Истаравшан',      4),
  ('grape',     'Ангур',          'Виноград',       'kg', 'fruit',     '🍇', 10, 15, 18, 26, 'flat', 'Хуҷанд',          5),
  ('walnut',    'Чормағз',        'Грецкий орех',   'kg', 'nut',       '🌰', 35, 45, 55, 70, 'up',   'Айнӣ',            6),
  ('almond',    'Бодом',          'Миндаль',        'kg', 'nut',       '🥜', 50, 65, 80, 100,'flat', 'Спитамен',        7),
  ('raisin',    'Мавиз',          'Изюм',           'kg', 'dried',     '🟤', 20, 28, 35, 48, 'down', 'Хуҷанд',          8),
  ('dried_apricot','Зардолуи хушк','Курага',        'kg', 'dried',     '🟠', 30, 40, 50, 65, 'flat', 'Бобоҷон Ғафуров', 9),
  ('tomato',    'Помидор',        'Помидор',        'kg', 'vegetable', '🍅', 4,  7,  9,  14, 'down', 'Хуҷанд',          10)
on conflict (item_key, effective_date) do nothing;
