"use client";

import { usePathname } from "next/navigation";
import { ArrowUpRight, Plane } from "lucide-react";

function shouldHideFooter(pathname: string | null): boolean {
  if (!pathname || pathname === "/") {
    return true;
  }

  // Airport guide pages already have back-nav; the light footer reads as a
  // second closing band under the nearby-airports section.
  return pathname === "/airports" || pathname.startsWith("/airports/");
}

export function SiteFooter() {
  const pathname = usePathname();

  if (shouldHideFooter(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-[#8e999d] bg-[linear-gradient(180deg,#e8ecee,#bdc6c9)] text-[#293235] shadow-[inset_0_1px_white]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <span className="flex items-center gap-3 font-heading text-xl font-semibold uppercase tracking-[0.08em]">
            <span className="flex size-8 items-center justify-center rounded-lg border border-[#78949d] bg-[linear-gradient(180deg,#fff,#a9c3cb)] text-[#356879] shadow-[inset_0_1px_white,0_2px_4px_rgb(53_70_76_/_0.2)]">
              <Plane className="size-4 -rotate-45" aria-hidden="true" />
            </span>
            HonestAirport
          </span>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
            Airportist Scores and guides are editorial content. Always verify
            live rules, terminals, and operational alerts with official airport
            and airline sources.
          </p>
        </div>
        <a
          href="/"
          className="group inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#526166] transition-colors hover:text-primary"
        >
          Return to board
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </div>
    </footer>
  );
}
