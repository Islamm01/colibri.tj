import { setRequestLocale } from 'next-intl/server';
import { TrackingClient } from '@/components/track/TrackingClient';

export const dynamic = 'force-dynamic';

export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  return <TrackingClient code={code} />;
}
