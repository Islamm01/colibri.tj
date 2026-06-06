'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

/**
 * Subscribes to Supabase realtime updates on the `orders` table.
 *
 * - storeId: if provided, filters to that store (for store dashboard)
 * - onChange: called on any INSERT or UPDATE to a relevant order
 *
 * Returns a `connected` ref so callers can show a "live" indicator.
 */
export function useRealtimeOrders(opts: {
  storeId?: string | null;
  onChange: () => void;
}): { connected: React.MutableRefObject<boolean> } {
  const connectedRef = useRef(false);
  const onChangeRef = useRef(opts.onChange);
  const storeIdRef = useRef(opts.storeId);

  // Keep refs current so the effect itself doesn't re-subscribe on every render
  useEffect(() => {
    onChangeRef.current = opts.onChange;
    storeIdRef.current = opts.storeId;
  });

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    // Channel name unique per store (or 'all' for operator)
    const channelName = opts.storeId ? `orders:store:${opts.storeId}` : 'orders:all';

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            ...(opts.storeId ? { filter: `store_id=eq.${opts.storeId}` } : {}),
          },
          () => {
            onChangeRef.current();
          },
        )
        .subscribe((status) => {
          connectedRef.current = status === 'SUBSCRIBED';
        });
    } catch (err) {
      // Realtime may not be enabled on this Supabase project — fail silently;
      // polling will continue to work as the fallback.
      console.warn('[colibri] Realtime subscription failed:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      connectedRef.current = false;
    };
    // We intentionally re-subscribe when storeId changes
  }, [opts.storeId]);

  return { connected: connectedRef };
}

/**
 * Subscribes to realtime updates for a single order (by id).
 * Used by the customer tracking page.
 */
export function useRealtimeOrder(opts: {
  orderId: string | null;
  onChange: () => void;
}): void {
  const onChangeRef = useRef(opts.onChange);

  useEffect(() => {
    onChangeRef.current = opts.onChange;
  });

  useEffect(() => {
    if (!opts.orderId) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`order:${opts.orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${opts.orderId}`,
          },
          () => onChangeRef.current(),
        )
        .subscribe();
    } catch (err) {
      console.warn('[colibri] Realtime subscription failed:', err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [opts.orderId]);
}
