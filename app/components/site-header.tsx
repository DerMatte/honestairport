import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { HeaderAccountLoader } from "@/app/components/header-account-loader";
import { HeaderChrome } from "@/app/components/header-chrome";
import { Skeleton } from "@/components/ui/skeleton";

export function SiteHeader({
  nearestAirportSlot,
  nearestAirportSidebarSlot,
  membershipSlot,
}: {
  /** RSC-rendered "Near you" link, streamed in behind a Suspense boundary. */
  nearestAirportSlot: ReactNode;
  nearestAirportSidebarSlot: ReactNode;
  /** RSC membership status; hidden when the Whop gate is off. */
  membershipSlot?: ReactNode;
}) {
  return (
    <HeaderChrome
      brand={
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Plane className="size-4 -rotate-45" aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-medium tracking-tight">
            HonestAirport
          </span>
        </Link>
      }
      desktopNav={nearestAirportSlot}
      desktopAccount={
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <HeaderAccountLoader membershipSlot={membershipSlot} />
        </Suspense>
      }
      nearestAirportSidebarSlot={nearestAirportSidebarSlot}
      membershipSlot={membershipSlot}
    />
  );
}
