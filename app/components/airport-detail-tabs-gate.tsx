import { Suspense } from "react";
import {
  AirportDetailTabs,
  type AirportDetailTabsProps,
} from "@/app/components/airport-detail-tabs";
import { getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";

/**
 * Resolves live Whop access inside Suspense so `cacheComponents` can
 * prerender the tab chrome with paid bodies locked (no `export const dynamic`).
 */
export function AirportDetailTabsGate(props: AirportDetailTabsProps) {
  if (!isWhopGateEnabled()) {
    return <AirportDetailTabs {...props} membershipAccess="open" />;
  }

  return (
    <Suspense
      fallback={<AirportDetailTabs {...props} membershipAccess="denied" />}
    >
      <AirportDetailTabsWithAccess {...props} />
    </Suspense>
  );
}

async function AirportDetailTabsWithAccess(props: AirportDetailTabsProps) {
  const access = await getHtmlAccess();
  return <AirportDetailTabs {...props} membershipAccess={access} />;
}
