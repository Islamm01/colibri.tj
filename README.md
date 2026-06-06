# Colibri — Web platform complete (Slices 1–14 + rebrand)

> Local delivery ecosystem for Khujand, Tajikistan.
> *(Formerly ANJIR — rebranded to **Colibri**, the hummingbird: fast, precise, far-reaching.)*

**Rebrand — Colibri.** The product was renamed from ANJIR to **Colibri** throughout: brand name, logo (new hummingbird mark — aubergine on transparent for the light UI, white-on-aubergine PWA icons), welcome splash (bird + "Colibri" wordmark + tagline), all UI text, metadata, PWA manifest, order-code prefix (`ANJ-` → `COL-`), session cookies, and support handle. Brand palette (aubergine/gold/cream) and typography (Onest + Playfair Display) are unchanged, so the rebrand is clean and consistent. New stores still start at zero reviews. No database or schema changes.

**Slice 14 — Reviews, analytics, dispatch visibility (final platform slice).**
1. **Store reviews & comments** — customers who have a *delivered* order from a store can leave a 1–5 star rating + comment (star picker modal). Store pages show a rating summary (average, star breakdown bars, count) and the comment list. New stores correctly start at zero; `stores.rating`/`rating_count` auto-recompute via DB trigger (migration 0013).
2. **Analytics dashboard** (`/staff/admin/analytics`) — KPI cards (orders, delivered, revenue, AOV), daily orders & revenue bar charts, busy-hours histogram, vertical & payment splits, courier leaderboard. 7/30/90-day ranges. Shows a clean empty state until real orders exist.
3. **Dispatch visibility** (`/staff/operator/dispatch`) — live (5s auto-refresh) view of orders mid-dispatch: how many couriers were offered, who accepted/declined/expired, wait time, and a flag when no couriers are available so the operator can step in.

This completes the web platform. Roles covered end-to-end: customers (browse, order fruit/parcel, track, review, order history), couriers (apply, work, deliver, history), stores (manage products, orders), operators (dispatch, prices, manual assign), admins (everything + analytics + payments + onboarding).

### Migration
No new migration — reviews use `0013_courier_apps_and_reviews.sql` (run it if you haven't). All prior migrations 0001–0013 should be applied.

### Next: the mobile app (separate project)
The platform is the backend + web storefront. The app phase builds: **one customer app** and **one combined courier+store app** (role-aware), both on the same Supabase backend, with native push for couriers/stores.

**Slice 13 — Order history fixes, courier recruitment, support relocation.**
1. **Customer order history fixed** — the orders page queried `user_id` but the column is `customer_user_id`, so it was always empty. Fixed; customers now see their real orders (incl. parcels) with status.
2. **Telegram support moved** — removed the floating button; support now lives as a labelled card at the bottom of the home screen, with the brand line.
3. **Courier order history** — the courier panel now keeps a "История доставок" list of delivered orders (with a "Сегодня: N" count) instead of going empty after each delivery.
4. **Courier self-application flow** — new public page `/[locale]/courier-apply`: a conditions/benefits screen the applicant reads first, then a form (name, phone, vehicle, district, about). Linked from the staff login ("стать курьером"). Admins review at `/staff/admin/couriers` and one-tap approve to create a courier login. Mirrors the partner-onboarding flow.

**Migration:** `supabase/migrations/0013_courier_apps_and_reviews.sql` — adds `courier_applications` and `store_reviews` (with an automatic stores.rating recompute trigger). The reviews **schema** ships now; the reviews **UI** (item 5) is the next slice.

### Run this migration
Apply `supabase/migrations/0013_courier_apps_and_reviews.sql`.

**Slice 12 — Admin panel (complete & wired).** The full admin back office is now reachable from the admin navigation:
- **Магазины** (`/staff/admin/stores`) — every store with activate/pause toggle and editable commission rate.
- **Заявки** (`/staff/admin`) — partner applications → one-tap approve creates store + owner login (from Slice 9).
- **Сотрудники** (`/staff/admin/staff`) — list staff by role (courier/operator/store_owner/admin), create new staff accounts with a password, reset passwords.
- **Заказы** (`/staff/admin/orders`) — all orders with manual courier assignment + payment confirmation.
- **Цены / Оплата / Настройки** — price index editor, payment settings, and platform settings (parcel pricing knobs, fruit delivery fee, default commission, support handle).
Also fixed: the staff nav active-state logic (the index route no longer highlights on every sub-page) and the mobile staff nav now scrolls horizontally for many items.

### Run this migration
Apply `supabase/migrations/0012_admin_panel.sql` (adds `platform_settings` and `delivery_zones` tables).

**Slice 11 — Payments (complete).** Full payment flow for the Tajikistan launch model:
- **Three methods**: cash on delivery, QR (scan ANJIR's bank QR), bank transfer (to ANJIR's card/account).
- **Admin payment settings** at `/staff/admin/payments` — toggle each method, set the QR image URL, card number, holder, bank name, and transfer note. These are what customers see at payment time.
- **Customer flow**: the tracking page shows the real QR / card details for non-cash orders, takes an optional transaction reference, and an "I've paid" button that moves the order to `awaiting_confirmation` (not instantly paid).
- **Staff confirmation**: operators/admins see "Клиент оплатил — проверьте" on awaiting orders and confirm or reject receipt. Confirming marks it paid; rejecting returns it to pending for retry.
- **Webhook scaffold** at `/api/payments/webhook` — ready for a real provider (Alif Mobi / Korti Milli). It rejects all calls until `PAYMENT_WEBHOOK_SECRET` is set and the provider's payload/signature is mapped, so it's safe to deploy now. When connected, it flips orders to paid automatically via the same path staff use manually.

This is "manual confirm now, automatic later" — you can take real money at launch (cash + QR/transfer with manual confirmation) without any provider integration, and switch on automation when you have a merchant account.

### Run this migration
Apply `supabase/migrations/0011_payments.sql` (adds `payment_settings` table, payment-tracking columns, and the `awaiting_confirmation` status).

**Slice 10 — Two bug fixes (revised).**
1. **Map modal stacking bug:** the full-screen map picker now renders through a React portal to `document.body` at `z-[2000]`, so payment options / sticky bars can no longer bleed on top of it. Affects both fruit checkout and parcel forms.
2. **Parcel order failure:** two real schema mismatches fixed. (a) The parcel API inserted `user_id` into `orders`, but the column is `customer_user_id` — corrected. (b) The `orders.vertical` column was referenced by indexes but never actually created in any migration. `supabase/migrations/0010_schema_safety.sql` (idempotent) now adds the `vertical` column first, makes `store_id` nullable, ensures all parcel columns/constraints/indexes exist, and confirms `parcel` is a valid vertical enum value. The API also now surfaces the real DB error `detail` so any future schema issue is diagnosable.

### Run this migration
Apply `supabase/migrations/0010_schema_safety.sql` in the Supabase SQL editor — this is required to fix the parcel-order error.

**Slice 9 — Address autocomplete in fruit checkout + admin store onboarding.**
Fixed: the fruit/dried-fruit checkout now uses the same address autocomplete as the parcel flow (type a street → suggestions that fill real coordinates, or tap the map button), replacing the old map-only picker. Both flows now feel identical.
New: a working **admin store-onboarding flow** at `/staff/admin`. Partner applications (from the `/partner` form) appear in a reviewable list grouped by status; approving one automatically creates a `store` record plus a `store_owner` login account and surfaces the generated credentials to hand to the merchant. This removes the bottleneck of adding every merchant by hand in the database. Admin also gets orders + prices views (reusing operator components). Fixes a latent bug where `/staff/admin` 404'd after admin login.

### No new migration
Uses existing tables (`partner_applications`, `stores`, `users`). Just deploy the code.

**Slice 8 — Price Index.** ANJIR's trust wedge: a daily public record of what produce costs in Khujand, shown as farm-gate vs bazaar price ranges with up/down trend arrows. Customers get a reason to open the app daily even when not ordering; ANJIR becomes the trusted source of honest produce prices before it monetizes the gap. New customer page `/[locale]/prices` (grouped by fruit/dried/nut/vegetable, with the "honest spread" explainer), a homepage entry banner, an operator daily-update tool at `/staff/operator/prices`, public `GET /api/price-index`, and operator `PATCH /api/staff/price-index`. Migration `0009_price_index.sql` adds the `price_index` table seeded with 10 realistic Khujand items.

### Run migration
Apply `supabase/migrations/0009_price_index.sql` in the Supabase SQL editor. The seed gives you today's prices immediately; the operator updates them daily from the dashboard.

### Strategic note
The Price Index is the first ANJIR feature that is a *daily habit* rather than a *transaction*. Cross-post the daily prices to a Telegram channel to build the audience that later converts into the agricultural supply-chain business (fertilizer inputs, wholesale farmer output).

**Slice 7** — Address autocomplete + distance pricing. Parcel delivery now calculates price by actual distance (15 TJS base covering first 2 km, +4 TJS/km after, +10 TJS for 5–15 kg) instead of a flat fee — a 500 m delivery costs the minimum, a 5 km delivery scales up fairly. Address fields are now type-ahead: start typing a street and get real address suggestions (street + house) that fill coordinates automatically, so pricing computes precisely. Map pins reverse-geocode into readable addresses. The "choose on map" control is a clean pin icon + label on the right of each field (no more map dumped at the bottom). Geocoding is provider-agnostic: set `GEOCODER_PROVIDER=yandex` + `YANDEX_GEOCODER_KEY` (or `2gis`) in `.env` for full Tajikistan coverage; falls back to free OpenStreetMap with no key.

### Geocoding setup (optional but recommended)
For accurate Khujand house-number autocomplete, register a Yandex Geocoder or 2GIS key and set in `.env.local`:
```
GEOCODER_PROVIDER=yandex
YANDEX_GEOCODER_KEY=your-key
```
Without a key it uses OpenStreetMap (free, streets work, house numbers patchy).

**Slice 6** — Dispatch reliability + visual refresh. Fixed the critical bug where couriers on shift never received orders (going online required GPS; dispatcher excluded couriers without a fresh GPS ping). Couriers now go online even if GPS fails, and broadcast dispatch reaches every online courier regardless of location data. Added **manual courier assignment** for operators (button in the order drawer). Parcel address fields are now typeable with an explicit "choose on map" button (map opens full-screen only when tapped, never clobbers typed text). Vertical cards rebuilt minimalist Yandex-style (clean aubergine icon tiles); fruit vertical renamed "Мева ва меваи хушк". Real transparent logo (black background programmatically removed) in greeting + splash + login. Richer button system (layered aubergine gradient with gold-lit edge, gold accent button), warmer page background wash, premium header wordmark.

### Migrations
Run `0008_partner_and_broadcast.sql` if not already applied (partner applications + dispatch config).

**Slice 5** — Orders history fixed (was a placeholder that never queried the DB; now shows the customer's real orders with status). Logo shown frameless (transparent SVG) on welcome + login. Profile cleaned up: removed broken "Guest" interaction and "Delivery addresses — soon"; "Become partner" now opens a real application form (`/partner`) that saves to `partner_applications`. Dispatch switched to **broadcast mode** — every online courier gets the offer, first to accept wins (toggle back to sequential via `dispatch_config` table once volume grows). Vertical cards got rich SVG illustrations (fruit cluster, gift-wrapped parcel). "Why ANJIR" rebuilt as a six-benefit grid (fresh, cash on delivery, fair prices, 60-min, quality guarantee, 24/7 support). Telegram support button floats on every customer page. Parcel form rebuilt Yandex-Go style — flat rows, full-screen map-on-tap modal, fixed 20-som price.

### New migration
Run `supabase/migrations/0008_partner_and_broadcast.sql` (adds `partner_applications` + `dispatch_config` tables).

**Slice 4f** — Polish & roadmap: real PNG logo integrated (splash + login + PWA icons), homepage in-page brand block removed, simplified fruit checkout (one address field instead of three redundant ones), saved-address deduplication, parcel button slimmed to single-row card, "Why ANJIR" rewritten with the real four-phase roadmap (fruits/parcels → fertilizers/agro → pharmacy → B2B wholesale), translation audit completed.

**Slice 4d** — Parcel delivery launches as a real second vertical: two-address form (pickup + dropoff with map pickers), category and weight selection, distance-based pricing (15 TJS base + 4 TJS/km + 10 TJS heavy-package surcharge), cash payer choice (sender or recipient), auto-dispatch to nearest courier (no store-accept step), couriers see parcels with sender/recipient cards instead of store/customer.

**Slice 1** — Foundation: homepage, marketplace, store + product browsing, live cart, full TJ + RU translations, complete database schema.

**Slice 2** — The conversion machine: guest checkout with soft-account recognition, GPS + map address picker, payment method selection, order creation API with idempotency, public order tracking page.

**Slice 3** — Staff dashboards: phone+password auth, store owner dashboard, operator dashboard.

**Slice 4a** — Realtime: orders inbox and customer tracking page use Supabase realtime (Postgres CDC) for instant updates.

**Slice 4b** — Couriers & dispatch: courier PWA, sequential dispatch with atomic accept, live courier map on the tracking page.

**Slice 4c** — Image pipeline & polish: real product/store image uploads via Supabase Storage with industry-standard crop UI (1:1 products, 1:1 logos, 16:9 covers), client-side WebP compression, branded fallback placeholders, all third-party Unsplash URLs purged. Fixed post-checkout redirect race. Replaced ecosystem strip with warm "Why ANJIR" story.

What's not yet built: admin panel, analytics, loyalty program, referrals (Slice 5).

---

## Quickstart (≈10 minutes)

### Prerequisites

- **Node.js 18.17+** (check: `node --version`)
- **A Supabase account** (free tier — [supabase.com](https://supabase.com))

That's it. No Docker, no Postgres install, no SMS provider.

---

### Step 1 — Install dependencies

```bash
npm install
```

This installs Next.js 15, Tailwind, next-intl, Zustand, and the Supabase client. ~1 minute.

---

### Step 2 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and click **New project**.
2. Name it `anjir-dev` (or whatever you like).
3. Choose a strong database password — **save it**, you'll need it.
4. Pick the region closest to Tajikistan. **Frankfurt (eu-central-1)** is currently the best option for Central Asia latency.
5. Click **Create new project**. Wait ~2 minutes for it to provision.

---

### Step 3 — Run the database migrations

In your Supabase dashboard:

1. Open the **SQL Editor** (left sidebar).
2. Click **+ New query**.
3. Open `supabase/migrations/0001_initial_schema.sql` from this repo.
4. Copy the **entire contents** into the SQL editor.
5. Click **Run**. You should see "Success. No rows returned."
6. **+ New query**. Run `supabase/migrations/0002_checkout_and_orders.sql`.
7. **+ New query**. Run `supabase/seed/seed.sql`.
8. **+ New query**. Run `supabase/migrations/0003_staff_dashboards.sql` (must run AFTER the seed so the store exists).
9. **+ New query**. Run `supabase/migrations/0004_realtime.sql` (enables realtime on the orders table).
10. **+ New query**. Run `supabase/migrations/0005_courier_dispatch.sql` (adds courier seed + dispatch tables).
11. **+ New query**. Run `supabase/migrations/0006_storage.sql` (creates storage buckets + strips any legacy Unsplash URLs).
12. **+ New query**. Run `supabase/migrations/0007_parcel_delivery.sql` (parcel order extensions).

You should now see tables in **Table Editor** → `stores` (1 row), `products` (8 rows), `delivery_zones` (1 row), `users` (3 rows: store_owner + operator + courier), `couriers` (1 row), plus the empty `orders`, `delivery_offers`, `addresses` tables ready to fill.

> **Tip:** If you need to start over, run `drop schema public cascade; create schema public;` then re-run all four SQL files in order.

---

### Step 4 — Configure environment variables

1. In Supabase, go to **Project Settings** → **API**.
2. You'll see three values you need:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon / public key** (a long JWT string)
   - **service_role secret** (a different long JWT — keep this private!)
3. In the project root:

```bash
cp .env.example .env.local
```

4. Generate a session secret:

```bash
openssl rand -hex 32
```

5. Open `.env.local` and fill in all four values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...     # different from anon key!
SESSION_SECRET=<paste output of openssl rand -hex 32>
```

> The service role key bypasses Row Level Security — it's used by the order creation API. **Never commit it or expose it to the browser.**

---

### Step 5 — Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should be redirected to `/tj` (Tajik default).

You should see:

- The ANJIR homepage with the fig purple wordmark
- "Available now" section with two cards: **Меваҳо ва чормағз** and **Расондани бор**
- "Anjir Ecosystem" strip with four future-vertical cards
- TJ | RU language switcher in the top right (try it!)
- Bottom navigation with 5 tabs

Tap **Меваҳо ва чормағз** → marketplace listing → tap **Боғи Хуҷанд** → product grid. Add an apricot to cart, tap the cart icon in the bottom nav, and watch the live totals + free-delivery progress bar appear.

---

## What you can do now

**Slice 1 (foundation):**
- ✅ Browse the homepage in TJ and RU
- ✅ See the live store count from Supabase
- ✅ Tap a product, add it to the cart, change quantity
- ✅ See cart subtotal, delivery fee, free-delivery progress, and total update live
- ✅ Sign up for the waitlist on a future vertical (writes to the `waitlist` table)
- ✅ Sign up as a partner shop owner (writes to the `waitlist` table with `type='partner'`)

**Slice 2 (checkout + tracking):**
- ✅ Tap "Checkout" on the cart drawer — full guest checkout flow
- ✅ "Use my location" button — silently falls back to map pin if denied
- ✅ Draggable pin on OpenStreetMap, Khujand-centered
- ✅ Phone recognition: type a phone — if it's ordered before, name auto-fills and a "Welcome back" message appears
- ✅ Saved address suggestions for recognized users
- ✅ Three payment methods: Cash, mock QR, Bank transfer
- ✅ Idempotent order creation: double-tapping never duplicates
- ✅ Public tracking page at `/tj/track/ANJ-XXXX` — shareable URL, no auth required
- ✅ Live status timeline (polls every 8s while not delivered)
- ✅ Mock QR / bank confirmation flow with "I've paid" button
- ✅ Homepage greeting becomes "Salom, Аброр" on return visits

**Try the full loop:**

1. Browse → add 2 kg of apricots and 1 kg of walnuts to cart
2. Cart drawer → notice the "X сом more for free delivery" progress bar
3. Tap "Ба пардохт" (Checkout)
4. Fill phone `+992 92 123 45 67`, name `Аброр`
5. Tap "Use my location" or drag the map pin
6. Pick QR payment → "Place order"
7. You land on `/tj/track/ANJ-XXXX` — the tracking page
8. Tap "I've paid" — status moves from "pending payment" to "placed"
9. Open a new browser → homepage now greets you by name

Check **Supabase Table Editor** → `users`, `addresses`, `orders`, `order_items`, `order_events` to see real data flowing.

**Slice 3 (staff dashboards):**

- ✅ Visit `/staff` — redirects to login
- ✅ Login at `/staff/login` with demo credentials
  - Store owner: `+992900000000` / `anjir2025`
  - Operator: `+992900000001` / `anjir2025`
- ✅ Store dashboard at `/staff/store/orders` — three-column orders inbox
- ✅ Polls every 5 seconds for new orders
- ✅ Sound notification + favicon flash when a new order arrives (click "Включить звук" once per session to enable audio)
- ✅ Tap any order card → opens detail drawer with full info, customer phone (tap to call), items, address, notes
- ✅ "Принять заказ" → "Готов к выдаче" → status transitions with proper authorization
- ✅ Product manager at `/staff/store/products` — create/edit/delete/hide products with TJ+RU names
- ✅ Hours editor at `/staff/store/hours` — per-day open/close times, emergency PAUSE button (one tap to hide the whole store)
- ✅ Settings at `/staff/store/settings` — name, description, address
- ✅ Operator dashboard at `/staff/operator` — same inbox but sees ALL stores' orders
- ✅ Staff session separate from customer session (different cookie, JWT-signed)
- ✅ Order events logged for every staff action (audit trail in `order_events` table)
- ✅ **Staff login entry point on Profile page** — discreet "Кабинет для сотрудников" link

**Slice 4a (realtime):**

- ✅ New orders appear in the staff inbox **instantly** — no waiting for the 5-second poll
- ✅ Status changes appear on the customer tracking page **instantly** — courier-side actions reflect in real time
- ✅ Supabase Realtime (Postgres CDC) — no new infrastructure, no Hetzner VPS yet
- ✅ Polling kept as 30-second safety net — if WebSocket drops or realtime is disabled, the UI still works
- ✅ Reconnects automatically if the connection drops

**Slice 4b (couriers & dispatch):**

- ✅ Courier login at `/staff/login` with the courier role
- ✅ Full courier app at `/staff/courier` with state-driven UI (offline / idle / offer / pickup / dropoff)
- ✅ "Go online" button with GPS permission flow — silently handles denial
- ✅ Sequential dispatch: when store marks order ready, nearest online courier within 5 km gets a 15-second offer
- ✅ **Atomic accept** — conditional Postgres UPDATE ensures two couriers can never claim the same order
- ✅ Reject or timeout → next courier auto-receives the offer
- ✅ Max 10 dispatch cycles before surfacing as `dispatch_failed` for operator intervention
- ✅ Pickup → dropoff flow with "Open in Google Maps" deep links and call-customer button
- ✅ GPS pinging: every 45 seconds while idle, every 15 seconds during active delivery
- ✅ Auto-frees courier when delivery completes — they can immediately accept the next offer
- ✅ **Live courier position on the customer tracking page** — Uber-style blue dot, updates instantly via realtime
- ✅ Smart map zoom: shows courier + store while picking up, courier + customer while delivering
- ✅ PWA manifest + icons — courier can "Add to Home Screen" on Android for app-like experience
- ✅ Demo courier account: `+992900000002` / `anjir2025`

**The full end-to-end loop (customer + store + courier with realtime):**

1. **Customer places order** — `/tj/marketplace` → add items → checkout (`+992 92 123 45 67` / `Аброр` / use location) → place order → lands on `/tj/track/ANJ-XXXX`
2. **Store accepts** — open new tab, log in as store owner (`+992900000000`), order is already in "Новые" column. Tap → "Принять заказ"
3. **Store marks ready** — same drawer → "Готов к выдаче". **The dispatcher fires automatically** and offers the order to the nearest online courier.
4. **Courier flow** — open a 3rd browser/incognito, go to `/staff/login`, log in as courier (`+992900000002`). Tap "Выйти на смену" → grant GPS permission → "Ожидаем заказ" screen.
5. **Offer arrives** — within seconds of step 3, the courier screen flips to the offer with a 15-second countdown, customer name, store, distance, total.
6. **Accept** — tap "Принять". Screen flips to delivery mode showing pickup at store. "Open in Maps" deep links to Google Maps.
7. **Pickup** — tap "Я забрал заказ". Screen advances to dropoff with customer address + phone.
8. **Customer tracking page** — back to the customer tab. **The Uber-style live map is showing**, with the courier as a green pulsing dot. As you move (or as ping updates the position), the dot moves in real time.
9. **Deliver** — courier taps "Заказ доставлен". Customer tracking page shows "Супорида шуд" / "Доставлен". Courier is freed and can take the next offer.

This is the entire platform end-to-end. Real customers, real stores, real couriers, real-time dispatch and tracking. Cash payments work today. Add a real payment provider when you're ready.

---

## Project structure

```
anjir/
├── src/
│   ├── app/
│   │   ├── [locale]/             # Locale-scoped routes (TJ, RU)
│   │   │   ├── layout.tsx        # Header, BottomNav, CartDrawer wrapper
│   │   │   ├── page.tsx          # Homepage
│   │   │   ├── marketplace/      # Fruits marketplace
│   │   │   │   ├── page.tsx      # Store listing
│   │   │   │   └── [storeSlug]/  # Store detail + products
│   │   │   ├── parcel/           # Parcel delivery (placeholder)
│   │   │   ├── orders/           # Customer orders (placeholder)
│   │   │   └── profile/          # Customer profile (placeholder)
│   │   ├── globals.css           # Design system + animations
│   │   └── layout.tsx            # Root layout
│   ├── components/
│   │   ├── home/                 # Homepage sections
│   │   ├── layout/               # Header, BottomNav, LanguageSwitcher
│   │   ├── marketplace/          # ProductCard
│   │   ├── cart/                 # CartDrawer
│   │   ├── ComingSoonScreen.tsx
│   │   └── SetupNotice.tsx
│   ├── lib/
│   │   ├── supabase/             # Browser + server clients
│   │   ├── cart-store.ts         # Zustand cart with persistence
│   │   ├── format.ts             # Currency, opening-hours logic
│   │   ├── types.ts              # Domain types
│   │   └── cn.ts                 # Tailwind class helper
│   └── i18n/
│       ├── config.ts             # Locale list, defaults
│       └── request.ts            # next-intl server config
├── messages/
│   ├── tj.json                   # Tajik translations (default)
│   └── ru.json                   # Russian translations
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql  # Full schema, all verticals ready
│   └── seed/
│       └── seed.sql              # 1 store, 8 products, 1 delivery zone
├── middleware.ts                 # Locale routing
├── tailwind.config.ts            # Design tokens (fig purple, cream, fonts)
├── next.config.mjs
├── tsconfig.json
└── package.json
```

---

## Design system reference

| Token | Value | Use |
|-------|-------|-----|
| `bg-cream` | `#fafaf8` | Page background |
| `text-fig-600` | `#7a219e` | Primary brand |
| `font-serif` | Playfair Display | Headings, brand |
| `font-sans` | Onest | Body, UI |
| `shadow-card` | soft fig-tinted | Cards |
| `btn-fig` | gradient + glow | Primary CTA |
| `glass-header` | blur + transparency | Top bar |
| `card-lift` | hover translate-Y | Interactive cards |
| `stagger > *` | sequential fade-up | List entrances |

> **Font choice note:** The brief mentioned DM Sans + DM Serif Display, but neither supports Cyrillic — which would break Tajik and Russian rendering. I swapped to **Onest** (a DM Sans–inspired modern geometric sans with full Cyrillic support, including all Tajik characters: ӣ ӯ ҳ ҷ ғ қ) and **Playfair Display** (a high-contrast display serif with Cyrillic). The aesthetic stays the same; the text actually works.

---

## What's next — Slice 5

When you're ready:

- **Admin panel** — manage stores (onboarding flow), users, commission rules, delivery zones
- **Analytics dashboards** — orders/revenue charts, courier performance, busiest hours, AOV trends
- **Operator dispatch dashboard** — visibility into the dispatch state machine, manual override when auto-dispatch fails
- **Loyalty program** — every 10th order free delivery, configurable
- **Referral system** — asymmetric reward (inviter gets credit, invitee gets free delivery on first order)
- **Real QR payment integration** — Alif Mobi or Korti Milli via webhook
- **Email/SMS receipts** for staff and customers (via a transactional provider)

Slice 6 territory: native mobile apps if PWA isn't enough, multi-city expansion, white-label for other regions.

---

## Troubleshooting

**The homepage shows a "Setup Supabase" notice**
Your `.env.local` is missing or has placeholder values. Re-do Step 4. After saving `.env.local`, restart `npm run dev`.

**"relation does not exist" error**
You skipped the migration. Run `supabase/migrations/0001_initial_schema.sql` in the SQL editor, then `supabase/seed/seed.sql`.

**Images don't load**
Slice 1 uses Unsplash placeholders. Make sure you have an internet connection. In production these become Supabase Storage URLs.

**Language switcher doesn't change content**
Check that `messages/tj.json` and `messages/ru.json` both exist and are valid JSON. The browser console will show parse errors.

**Build error: "next-intl plugin not found"**
Run `npm install` again. If still failing, delete `node_modules` and `package-lock.json` and re-install.

---

## Production deploy notes (for later)

- **Frontend:** Vercel — auto-deploys on git push, free for hobby.
- **Database:** Supabase free tier covers ~500MB DB, 1GB storage, 2GB bandwidth. Plenty for MVP launch.
- **Realtime service** (Slice 4): a $5/mo Hetzner VPS with Node + Redis. Vercel can't hold WebSocket connections.
- **Images:** Cloudflare Images ($5/mo) or imgproxy on the same VPS.
- **Domain:** point `anjir.tj` (or your domain) at Vercel.

Total monthly infra cost at MVP scale: ~$10–30. This is intentional — a Tajikistan startup shouldn't burn $500/mo on infra before product-market fit.

---

Built carefully, with founder-level discipline. Let's ship.
# colibri.tj
