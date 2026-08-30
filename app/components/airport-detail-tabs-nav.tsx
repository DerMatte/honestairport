"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, Plane } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  airportTabLabel,
  isPaidAirportTab,
  resolveAirportTab,
  type AirportTabValue,
} from "@/lib/airport-tabs";
import type { HtmlAccess } from "@/lib/whop-gate";

const detailTabClassName =
  "h-9 px-3 text-xs sm:text-sm data-active:text-primary after:bg-primary";

export interface AirportDetailTabsNavProps {
  iata: string;
  visibleTabs: readonly AirportTabValue[];
  membershipAccess: HtmlAccess;
  children: ReactNode;
}

function scrollTabChrome(element: HTMLElement | null) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  element?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function AirportDetailTabsController({
  iata,
  visibleTabs,
  membershipAccess,
  requestedTab,
  currentQuery,
  children,
}: AirportDetailTabsNavProps & {
  requestedTab: string | null;
  currentQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const chromeRef = useRef<HTMLDivElement>(null);
  const value = resolveAirportTab(requestedTab, visibleTabs);
  const showLocks = membershipAccess === "denied";
  const shouldScrollOnMount = Boolean(
    requestedTab && requestedTab !== "overview",
  );

  useEffect(() => {
    if (shouldScrollOnMount) {
      scrollTabChrome(chromeRef.current);
    }
  }, [shouldScrollOnMount]);

  function onValueChange(next: string) {
    const params = new URLSearchParams(currentQuery);
    if (next === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    scrollTabChrome(chromeRef.current);
  }

  return (
    <Tabs value={value} onValueChange={onValueChange} className="gap-6">
      <div
        ref={chromeRef}
        className="sticky top-[var(--site-header-offset)] z-30 -mx-2 scroll-mt-[var(--site-header-offset)] border-y border-border/70 bg-background/92 shadow-sm shadow-foreground/5 backdrop-blur-xl transition-[top] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none sm:-mx-3 sm:rounded-2xl sm:border"
      >
        <div className="flex min-h-14 min-w-0 items-center gap-2 px-2 sm:px-3">
          <div className="flex shrink-0 items-center gap-2 border-r border-border/70 pr-3">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Plane className="size-4 -rotate-45" aria-hidden="true" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-[0.12em] text-primary">
              {iata}
            </span>
            <span className="hidden text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase lg:inline">
              Guide
            </span>
          </div>

          <div className="relative min-w-0 flex-1 after:pointer-events-none after:absolute after:inset-y-1 after:right-0 after:w-6 after:bg-linear-to-l after:from-background after:to-transparent sm:after:hidden">
            <div className="overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList
                aria-label={`${iata} guide sections`}
                className="h-9 w-max gap-1 pr-5 sm:pr-0"
                variant="line"
              >
                {visibleTabs.map((tab) => {
                  const label = airportTabLabel(tab);
                  const locked = showLocks && isPaidAirportTab(tab);
                  return (
                    <TabsTrigger
                      key={tab}
                      className={detailTabClassName}
                      value={tab}
                      aria-label={locked ? `${label} (members)` : undefined}
                    >
                      {locked ? (
                        <Lock className="size-3" aria-hidden="true" />
                      ) : null}
                      {label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          </div>
        </div>
      </div>
      {children}
    </Tabs>
  );
}

function AirportDetailTabsFromUrl(props: AirportDetailTabsNavProps) {
  const searchParams = useSearchParams();
  return (
    <AirportDetailTabsController
      {...props}
      requestedTab={searchParams.get("tab")}
      currentQuery={searchParams.toString()}
    />
  );
}

/**
 * Client tab controller. `useSearchParams` stays inside Suspense so the
 * airport page can still prerender under Cache Components.
 */
export function AirportDetailTabsNav(props: AirportDetailTabsNavProps) {
  return (
    <Suspense
      fallback={
        <AirportDetailTabsController
          {...props}
          requestedTab={null}
          currentQuery=""
        />
      }
    >
      <AirportDetailTabsFromUrl {...props} />
    </Suspense>
  );
}
