import { setRequestLocale } from 'next-intl/server';
import { HeroGreeting } from '@/components/home/HeroGreeting';
import { TrustStrip } from '@/components/home/TrustStrip';
import { ActiveVerticals } from '@/components/home/ActiveVerticals';
import { GiftFeatureStrip } from '@/components/home/GiftFeatureStrip';
import { PriceIndexBanner } from '@/components/home/PriceIndexBanner';
import { WhyColibri } from '@/components/home/WhyColibri';
import { HomeSupportFooter } from '@/components/home/HomeSupportFooter';
import { WelcomeSplash } from '@/components/home/WelcomeSplash';
import { SetupNotice } from '@/components/SetupNotice';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
import { getGiftProducts } from '@/lib/gifts';
import { readSession } from '@/lib/session/server';
import type { Product } from '@/lib/types';

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
  let fruitImageUrl: string | null = null;
  let featuredGift: Product | null = null;
  let giftImageUrl: string | null = null;
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

      // A representative fruit cover for the pillar card background.
      const { data: fruitStore } = await supabase
        .from('stores')
        .select('cover_image_url')
        .eq('vertical', 'fruits')
        .eq('is_active', true)
        .not('cover_image_url', 'is', null)
        .order('rating', { ascending: false })
        .limit(1)
        .maybeSingle();
      fruitImageUrl = fruitStore?.cover_image_url ?? null;

      const gifts = await getGiftProducts(supabase, { limit: 12 });
      featuredGift = gifts[0] ?? null;
      // Pillar art prefers an operator-pinned category cover, else the featured set.
      giftImageUrl =
        (gifts.find((g) => g.is_category_cover) ?? featuredGift)?.images?.[0]?.url ?? null;
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
      <ActiveVerticals
        fruitStoreCount={fruitStoreCount}
        fruitImageUrl={fruitImageUrl}
        giftImageUrl={giftImageUrl}
      />
      <GiftFeatureStrip product={featuredGift} locale={locale} />
      <PriceIndexBanner />
      <WhyColibri />
      <HomeSupportFooter />
    </div>
  );
}
