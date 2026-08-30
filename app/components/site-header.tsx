import type { ReactNode } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { HeaderAccountMenu } from "@/app/components/header-account-menu";
import { HeaderChrome } from "@/app/components/header-chrome";

export function SiteHeader({
  nearestAirportSlot,
  nearestAirportSidebarSlot,
}: {
  /** RSC-rendered "Near you" link, streamed in behind a Suspense boundary. */
  nearestAirportSlot: ReactNode;
  nearestAirportSidebarSlot: ReactNode;
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
      desktopNav={
        <>
          {nearestAirportSlot}
          <Link
            href="/tsa-tips"
            className="px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            TSA tips
          </Link>
          <Link
            href="/members"
            className="px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Members
          </Link>
          <HeaderAccountMenu />
        </>
      }
      nearestAirportSidebarSlot={nearestAirportSidebarSlot}
    />
  );
}
