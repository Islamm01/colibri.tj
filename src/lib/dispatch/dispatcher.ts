// =====================================================================
// Colibri — Sequential dispatch engine
//
// Algorithm:
//   1. When store marks order "ready", call dispatchNextOffer(orderId)
//   2. We find the nearest online courier who:
//      - Hasn't received an offer for this order yet
//      - Isn't currently on a delivery
//      - Has a recent GPS ping (< 5 min old)
//      - Is within configured search radius of the store
//   3. We INSERT an offer with 15s expiry
//   4. Courier sees it via realtime, accepts or rejects
//   5. On reject/expire, we call dispatchNextOffer again
//
// Atomic accept:
//   - Conditional UPDATE on delivery_offers (only if still 'pending')
//   - Conditional UPDATE on orders (only if courier_id IS NULL)
//   - If either fails → race condition → caller treats as already-claimed
// =====================================================================

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { distanceKm } from '@/lib/orders/pricing';
import { notifyUsers } from '@/lib/push/notify';

export const OFFER_TIMEOUT_SECONDS = 25;
export const SEARCH_RADIUS_KM = 5; // courier must be within this of pickup store
export const STALE_PING_MINUTES = 5; // courier ping must be fresher than this
export const MAX_DISPATCH_CYCLES = 10; // give up after this many courier rotations

interface DispatchResult {
  ok: boolean;
  reason?: 'no_couriers' | 'order_already_assigned' | 'max_cycles' | 'error';
  offerId?: string;
  courierId?: string;
}

/**
 * Find next eligible courier and create a pending offer for them.
 * Idempotent: if an offer is already pending for this order, returns that one.
 */
export async function dispatchNextOffer(orderId: string): Promise<DispatchResult> {
  const supabase = getSupabaseAdmin();

  // Load order with both possible pickup-point sources:
  //   - food orders: store coordinates (via store_id join)
  //   - parcel orders: pickup_address coordinates (via pickup_address_id join)
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, courier_id, store_id, vertical, dispatch_attempts,
      store:store_id (lat, lng),
      pickup_address:pickup_address_id (lat, lng)
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return { ok: false, reason: 'error' };
  if (order.courier_id) return { ok: false, reason: 'order_already_assigned' };
  if (order.dispatch_attempts >= MAX_DISPATCH_CYCLES) {
    await markDispatchFailed(orderId);
    return { ok: false, reason: 'max_cycles' };
  }

  // Already an active offer for this order? Bail (caller can poll for changes)
  const { data: existingOffer } = await supabase
    .from('delivery_offers')
    .select('id, courier_id, expires_at')
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingOffer) {
    // Check if expired — clean it up first
    if (new Date(existingOffer.expires_at) < new Date()) {
      await supabase
        .from('delivery_offers')
        .update({ status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', existingOffer.id)
        .eq('status', 'pending');
      // Fall through to make a new offer
    } else {
      // Still active — return it
      return { ok: true, offerId: existingOffer.id, courierId: existingOffer.courier_id };
    }
  }

  // Collect set of couriers who have already been offered this order
  const { data: priorOffers } = await supabase
    .from('delivery_offers')
    .select('courier_id')
    .eq('order_id', orderId);
  const excludedCourierIds = (priorOffers ?? []).map((o) => o.courier_id);

  // Find eligible couriers — online with a recent-ish ping.
  // We do NOT require GPS coordinates: in broadcast mode every online courier
  // should get the offer. Couriers with coords get distance-sorted; those
  // without simply go to the back of the list. This avoids the common failure
  // where a courier is on shift but their browser hasn't sent a GPS ping yet.
  const staleCutoff = new Date(Date.now() - STALE_PING_MINUTES * 60 * 1000).toISOString();
  const { data: candidatesRaw } = await supabase
    .from('couriers')
    .select('user_id, last_lat, last_lng, last_ping_at, status')
    .eq('status', 'online');

  // Prefer couriers with a recent ping, but if none have one (flaky GPS),
  // still include all online couriers rather than dropping the order.
  let candidates = (candidatesRaw ?? []).filter(
    (c) => !c.last_ping_at || c.last_ping_at >= staleCutoff,
  );
  if (candidates.length === 0 && (candidatesRaw ?? []).length > 0) {
    candidates = candidatesRaw ?? [];
  }

  if (!candidates || candidates.length === 0) {
    return await retryOrFail(orderId);
  }

  // Pickup-point coordinates: store for food orders, pickup_address for parcels
  let pickupLat: number | null = null;
  let pickupLng: number | null = null;
  if (order.vertical === 'parcel') {
    const pickupData = Array.isArray(order.pickup_address) ? order.pickup_address[0] : order.pickup_address;
    pickupLat = pickupData?.lat ?? null;
    pickupLng = pickupData?.lng ?? null;
  } else {
    const storeData = Array.isArray(order.store) ? order.store[0] : order.store;
    pickupLat = storeData?.lat ?? null;
    pickupLng = storeData?.lng ?? null;
  }
  // Pickup coords may be null if a store/address lacks them — that's OK for
  // broadcast (we just can't sort by distance). Only sequential strictly needs them.
  const havesPickup = pickupLat != null && pickupLng != null;

  // Read dispatch mode (defaults to 'broadcast' if config row missing)
  const { data: cfg } = await supabase
    .from('dispatch_config')
    .select('mode')
    .eq('id', 1)
    .maybeSingle();
  const mode: 'sequential' | 'broadcast' = (cfg?.mode === 'sequential' ? 'sequential' : 'broadcast');

  // Build the eligible list. Compute distance when we can; otherwise leave it null.
  const notYetOffered = candidates.filter((c) => !excludedCourierIds.includes(c.user_id));

  const withDistance = notYetOffered.map((c) => {
    const canMeasure = havesPickup && c.last_lat != null && c.last_lng != null;
    return {
      courierId: c.user_id,
      distanceKm: canMeasure ? distanceKm(pickupLat!, pickupLng!, c.last_lat!, c.last_lng!) : null,
    };
  });

  let eligible: { courierId: string; distanceKm: number | null }[];
  if (mode === 'broadcast') {
    // Everyone online (not yet offered) is eligible. Sort by distance when
    // known; couriers without coords sort to the end.
    eligible = withDistance.sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  } else {
    // Sequential: only couriers within radius, nearest first. Requires coords.
    eligible = withDistance
      .filter((c) => c.distanceKm != null && c.distanceKm <= SEARCH_RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  if (eligible.length === 0) {
    return await retryOrFail(orderId);
  }

  const cycle = (order.dispatch_attempts ?? 0) + 1;
  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000).toISOString();

  if (mode === 'broadcast') {
    // Fan-out: create a pending offer for EVERY eligible courier.
    // First one to accept wins (accept handler uses an atomic UPDATE that
    // checks order.courier_id IS NULL, which is the same as in sequential).
    const offerRows = eligible.map((c) => ({
      order_id: orderId,
      courier_id: c.courierId,
      status: 'pending' as const,
      expires_at: expiresAt,
      cycle,
      distance_km: c.distanceKm,
    }));

    const { data: inserted, error: bcastErr } = await supabase
      .from('delivery_offers')
      .insert(offerRows)
      .select('id, courier_id');

    if (bcastErr || !inserted || inserted.length === 0) {
      // Concurrent dispatch run beat us — check for an existing offer
      const { data: maybeDup } = await supabase
        .from('delivery_offers')
        .select('id, courier_id')
        .eq('order_id', orderId)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();
      if (maybeDup) return { ok: true, offerId: maybeDup.id, courierId: maybeDup.courier_id };
      return { ok: false, reason: 'error' };
    }

    await supabase.from('orders').update({ dispatch_attempts: cycle }).eq('id', orderId);
    await supabase.from('order_events').insert({
      order_id: orderId,
      event_type: 'order.dispatch.broadcast',
      actor_role: 'system',
      payload: { offer_count: inserted.length, cycle },
    });

    // Native push to every courier who just got an offer — the real
    // courier-facing trigger (broadcast fan-out). Best-effort.
    await notifyUsers(inserted.map((o) => o.courier_id), {
      title: 'Фармоиши нав — Colibri',
      body: 'Фармоиши нав дастрас аст. Зуд қабул кунед.',
      data: { type: 'offer_created', orderId },
      channelId: 'orders',
    });

    // Return the first offer ID (used by the calling API for logging only)
    return { ok: true, offerId: inserted[0].id, courierId: inserted[0].courier_id };
  }

  // ---------- sequential (legacy) ----------
  const chosen = eligible[0];

  // Create the offer
  const { data: newOffer, error: offerErr } = await supabase
    .from('delivery_offers')
    .insert({
      order_id: orderId,
      courier_id: chosen.courierId,
      status: 'pending',
      expires_at: expiresAt,
      cycle,
      distance_km: chosen.distanceKm,
    })
    .select('id, courier_id')
    .single();

  if (offerErr || !newOffer) {
    const { data: maybeDup } = await supabase
      .from('delivery_offers')
      .select('id, courier_id')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle();
    if (maybeDup) return { ok: true, offerId: maybeDup.id, courierId: maybeDup.courier_id };
    return { ok: false, reason: 'error' };
  }

  await supabase
    .from('orders')
    .update({ dispatch_attempts: cycle })
    .eq('id', orderId);

  // Audit log
  await supabase.from('order_events').insert({
    order_id: orderId,
    event_type: 'dispatch.offer_created',
    actor_role: 'operator',
    payload: { offer_id: newOffer.id, courier_id: chosen.courierId, cycle, distance_km: chosen.distanceKm },
  });

  // Native push to the chosen courier (sequential mode). Best-effort.
  await notifyUsers([chosen.courierId], {
    title: 'Фармоиши нав — Colibri',
    body: 'Ба шумо фармоиши нав пешниҳод шуд. Зуд қабул кунед.',
    data: { type: 'offer_created', orderId },
    channelId: 'orders',
  });

  return { ok: true, offerId: newOffer.id, courierId: newOffer.courier_id };
}

async function retryOrFail(orderId: string): Promise<DispatchResult> {
  // No eligible couriers right now. Increment attempts; if we've already tried hard,
  // mark dispatch failed so operator picks it up.
  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('dispatch_attempts')
    .eq('id', orderId)
    .maybeSingle();
  const attempts = (order?.dispatch_attempts ?? 0) + 1;

  if (attempts >= MAX_DISPATCH_CYCLES) {
    await markDispatchFailed(orderId);
    return { ok: false, reason: 'max_cycles' };
  }

  await supabase
    .from('orders')
    .update({ dispatch_attempts: attempts })
    .eq('id', orderId);
  return { ok: false, reason: 'no_couriers' };
}

async function markDispatchFailed(orderId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('orders')
    .update({ dispatch_failed: true })
    .eq('id', orderId);
  await supabase.from('order_events').insert({
    order_id: orderId,
    event_type: 'dispatch.failed',
    actor_role: 'operator',
    payload: { reason: 'no_eligible_courier_after_max_cycles' },
  });
}

/**
 * Atomically accept an offer. Returns true if accepted, false if it was already
 * taken / expired / belongs to a different courier.
 */
export async function acceptOffer(opts: {
  offerId: string;
  courierId: string;
}): Promise<{ accepted: boolean; orderId?: string }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Step 1: claim the offer (conditional update)
  const { data: claimedOffer } = await supabase
    .from('delivery_offers')
    .update({ status: 'accepted', responded_at: now })
    .eq('id', opts.offerId)
    .eq('courier_id', opts.courierId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .select('id, order_id')
    .maybeSingle();

  if (!claimedOffer) return { accepted: false };

  // Step 2: claim the order (only if no courier is yet set)
  const { data: claimedOrder } = await supabase
    .from('orders')
    .update({
      courier_id: opts.courierId,
      status: 'courier_assigned',
    })
    .eq('id', claimedOffer.order_id)
    .is('courier_id', null)
    .select('id, status')
    .maybeSingle();

  if (!claimedOrder) {
    // Order somehow got claimed by another path between our steps. Reverse the offer.
    await supabase
      .from('delivery_offers')
      .update({ status: 'rejected', responded_at: now })
      .eq('id', opts.offerId);
    return { accepted: false };
  }

  // Step 3: lock the courier to this order
  await supabase
    .from('couriers')
    .update({ status: 'on_delivery', current_order_id: claimedOffer.order_id })
    .eq('user_id', opts.courierId);

  // Step 4: Mark all OTHER pending offers for this order as superseded.
  // In broadcast mode we created an offer for every online courier; once one
  // accepts, the others' offer cards should vanish from their screens.
  await supabase
    .from('delivery_offers')
    .update({ status: 'rejected', responded_at: now })
    .eq('order_id', claimedOffer.order_id)
    .eq('status', 'pending')
    .neq('id', opts.offerId);

  // Audit
  await supabase.from('order_events').insert({
    order_id: claimedOffer.order_id,
    event_type: 'dispatch.offer_accepted',
    actor_id: opts.courierId,
    actor_role: 'courier',
    payload: { offer_id: opts.offerId },
  });

  return { accepted: true, orderId: claimedOffer.order_id };
}

/**
 * Reject an offer (or mark expired). Triggers next dispatch.
 */
export async function rejectOffer(opts: {
  offerId: string;
  courierId: string;
  reason: 'rejected' | 'expired';
}): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: offer } = await supabase
    .from('delivery_offers')
    .update({
      status: opts.reason,
      responded_at: new Date().toISOString(),
    })
    .eq('id', opts.offerId)
    .eq('status', 'pending')
    .select('order_id')
    .maybeSingle();

  if (!offer) return; // Already responded; no-op

  await getSupabaseAdmin().from('order_events').insert({
    order_id: offer.order_id,
    event_type: `dispatch.offer_${opts.reason}`,
    actor_id: opts.reason === 'rejected' ? opts.courierId : undefined,
    actor_role: 'courier',
    payload: { offer_id: opts.offerId },
  });

  // In broadcast mode, other couriers may still have pending offers for this
  // order — don't kick another dispatch round until all live offers are gone.
  const { count: stillPendingCount } = await supabase
    .from('delivery_offers')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', offer.order_id)
    .eq('status', 'pending');

  if ((stillPendingCount ?? 0) === 0) {
    // Last live offer just died — kick a new dispatch round
    await dispatchNextOffer(offer.order_id);
  }
}
