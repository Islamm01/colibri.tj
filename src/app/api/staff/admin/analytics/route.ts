import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

// GET /api/staff/admin/analytics?days=30
export async function GET(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days')) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const supabase = getSupabaseAdmin();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, status, vertical, created_at, courier_id, payment_method')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const list = orders ?? [];
  const delivered = list.filter((o) => o.status === 'delivered');
  const cancelled = list.filter((o) => o.status === 'cancelled');

  const revenue = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
  const aov = delivered.length > 0 ? revenue / delivered.length : 0;

  // Daily series (orders + revenue)
  const dayMap: Record<string, { orders: number; revenue: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    dayMap[d] = { orders: 0, revenue: 0 };
  }
  for (const o of list) {
    const d = String(o.created_at).slice(0, 10);
    if (dayMap[d]) {
      dayMap[d].orders += 1;
      if (o.status === 'delivered') dayMap[d].revenue += Number(o.total || 0);
    }
  }
  const daily = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }));

  // By vertical
  const byVertical: Record<string, number> = {};
  for (const o of list) {
    const v = o.vertical || 'fruits';
    byVertical[v] = (byVertical[v] ?? 0) + 1;
  }

  // Busy hours (0-23)
  const hours = Array(24).fill(0) as number[];
  for (const o of list) {
    const h = new Date(o.created_at).getHours();
    hours[h] += 1;
  }

  // Payment method split
  const byPayment: Record<string, number> = {};
  for (const o of list) {
    const m = o.payment_method || 'cash';
    byPayment[m] = (byPayment[m] ?? 0) + 1;
  }

  // Courier leaderboard (delivered counts)
  const courierCounts: Record<string, number> = {};
  for (const o of delivered) {
    if (o.courier_id) courierCounts[o.courier_id] = (courierCounts[o.courier_id] ?? 0) + 1;
  }
  const topCourierIds = Object.entries(courierCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let couriers: { name: string; count: number }[] = [];
  if (topCourierIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', topCourierIds.map(([id]) => id));
    const nameMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]));
    couriers = topCourierIds.map(([id, count]) => ({ name: nameMap[id] || 'Курьер', count }));
  }

  return NextResponse.json({
    summary: {
      totalOrders: list.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      revenue: Math.round(revenue),
      aov: Math.round(aov),
      days,
    },
    daily,
    byVertical,
    byPayment,
    hours,
    couriers,
  });
}
