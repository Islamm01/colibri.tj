import { setRequestLocale } from 'next-intl/server';
import { HeroGreeting } from '@/components/home/HeroGreeting';
import { TrustStrip } from '@/components/home/TrustStrip';
import { ActiveVerticals } from '@/components/home/ActiveVerticals';
import { PriceIndexBanner } from '@/components/home/PriceIndexBanner';
import { WhyColibri } from '@/components/home/WhyColibri';
import { HomeSupportFooter } from '@/components/home/HomeSupportFooter';
import { WelcomeSplash } from '@/components/home/WelcomeSplash';
import { SetupNotice } from '@/components/SetupNotice';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { readSession } from '@/lib/session/server';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await readSession();

  // Get live store count if Supabase is configured; otherwise show setup notice
  let fruitStoreCount = 1;
  let supabaseReady = isSupabaseConfigured();

  if (supabaseReady) {
    try {
      const supabase = await getSupabaseServer();
      const { count } = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .eq('vertical', 'fruits')
        .eq('is_active', true);
      fruitStoreCount = count ?? 1;
    } catch {
      supabaseReady = false;
    }
  }

  return (
    <div>
      <WelcomeSplash />
      <HeroGreeting name={session?.name ?? null} />
      <TrustStrip />
      {!supabaseReady && <SetupNotice locale={locale} />}
      <ActiveVerticals fruitStoreCount={fruitStoreCount} />
      <PriceIndexBanner />
      <WhyColibri />
      <HomeSupportFooter />
    </div>
  );
}
