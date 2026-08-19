import type { ReactNode } from "react";
import { MembershipTeaser } from "@/app/components/membership-teaser";
import { getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";
import { getAirportTeaser } from "@/lib/whop-teaser";

// When Whop env is present at build/runtime, these pages must not be served
// from a prerendered full-intel snapshot. Off = keep today's static behavior.
export const dynamic =
  process.env.WHOP_API_KEY && process.env.WHOP_PRODUCT_ID
    ? "force-dynamic"
    : "auto";

interface AirportIntelLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AirportIntelLayout({
  children,
  params,
}: AirportIntelLayoutProps) {
  if (!isWhopGateEnabled()) {
    return children;
  }

  const access = await getHtmlAccess();
  if (access !== "denied") {
    return children;
  }

  const { slug } = await params;
  const teaser = await getAirportTeaser(slug);
  if (!teaser) {
    return children;
  }

  const returnPath = `/airports/${slug.trim().toLowerCase()}`;
  return <MembershipTeaser teaser={teaser} returnPath={returnPath} />;
}
