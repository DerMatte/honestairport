import { Suspense, type ReactNode } from "react";
import { MembershipTeaser } from "@/app/components/membership-teaser";
import { getAirportLounge } from "@/lib/airport-content";
import { getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";
import { getAirportTeaser, type AirportTeaser } from "@/lib/whop-teaser";

interface LoungePageLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string; loungeSlug: string }>;
}

export default async function LoungePageLayout({
  children,
  params,
}: LoungePageLayoutProps) {
  if (!isWhopGateEnabled()) {
    return children;
  }

  const { slug, loungeSlug } = await params;
  const iata = slug.trim().toUpperCase();
  const airportPath = `/airports/${slug.trim().toLowerCase()}`;
  const returnPath = `${airportPath}?tab=lounges`;
  const [teaser, lounge] = await Promise.all([
    getAirportTeaser(slug),
    getAirportLounge(iata, loungeSlug),
  ]);
  const locked = teaser ? (
    <MembershipTeaser
      teaser={teaser}
      returnPath={returnPath}
      scope="lounge"
      heading={lounge?.name}
      backHref={returnPath}
      backLabel="Back to lounges"
    />
  ) : (
    children
  );

  return (
    <Suspense fallback={locked}>
      <WhopGatedLounge
        teaser={teaser}
        loungeName={lounge?.name}
        returnPath={returnPath}
      >
        {children}
      </WhopGatedLounge>
    </Suspense>
  );
}

/**
 * Live `users.checkAccess` + session cookie. Must sit inside Suspense —
 * `export const dynamic` is not compatible with `cacheComponents`.
 * Fallback is the public teaser so prerender never ships lounge HTML.
 */
async function WhopGatedLounge({
  children,
  teaser,
  loungeName,
  returnPath,
}: {
  children: ReactNode;
  teaser: AirportTeaser | null;
  loungeName?: string;
  returnPath: string;
}) {
  const access = await getHtmlAccess();
  if (access !== "denied") {
    return children;
  }
  if (!teaser) {
    return children;
  }
  return (
    <MembershipTeaser
      teaser={teaser}
      returnPath={returnPath}
      scope="lounge"
      heading={loungeName}
      backHref={returnPath}
      backLabel="Back to lounges"
    />
  );
}
