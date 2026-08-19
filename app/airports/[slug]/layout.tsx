import { Suspense, type ReactNode } from "react";
import { MembershipTeaser } from "@/app/components/membership-teaser";
import { getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";
import { getAirportTeaser, type AirportTeaser } from "@/lib/whop-teaser";

interface AirportIntelLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AirportIntelLayout({
  children,
  params,
}: AirportIntelLayoutProps) {
  // Env-only check — no cookies — so missing Whop env keeps today's prerender.
  if (!isWhopGateEnabled()) {
    return children;
  }

  const { slug } = await params;
  const teaser = await getAirportTeaser(slug);
  const returnPath = `/airports/${slug.trim().toLowerCase()}`;
  const locked = teaser ? (
    <MembershipTeaser teaser={teaser} returnPath={returnPath} />
  ) : (
    children
  );

  return (
    <Suspense fallback={locked}>
      <WhopGatedAirport teaser={teaser} returnPath={returnPath}>
        {children}
      </WhopGatedAirport>
    </Suspense>
  );
}

/**
 * Live `users.checkAccess` + session cookie. Must sit inside Suspense —
 * `export const dynamic` is not compatible with `cacheComponents`.
 * Fallback is the public teaser so prerender never ships scores/guide/reviews.
 */
async function WhopGatedAirport({
  children,
  teaser,
  returnPath,
}: {
  children: ReactNode;
  teaser: AirportTeaser | null;
  returnPath: string;
}) {
  const access = await getHtmlAccess();
  if (access !== "denied") {
    return children;
  }
  if (!teaser) {
    return children;
  }
  return <MembershipTeaser teaser={teaser} returnPath={returnPath} />;
}
